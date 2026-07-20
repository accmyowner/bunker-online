/**
 * room.js — единая точка работы с комнатой.
 *
 * Экран не знает, что под ним: Firebase или локальный канал.
 * Он вызывает createRoom / joinRoom / patch и слушает EV.ROOM_UPDATE.
 *
 * Устойчивость к переподключению обеспечивается тремя вещами:
 *   1. Идентификатор игрока хранится на устройстве и переживает перезагрузку.
 *   2. Выход из вкладки не удаляет игрока, а лишь снимает флаг online.
 *   3. Последняя комната запоминается, и при возврате мы входим в неё же.
 */
import { emit, EV } from '../core/bus.js';
import * as storage from '../core/storage.js';
import { roomCode as makeCode, uid } from '../core/rng.js';
import { isConfigured, HEARTBEAT_MS, OFFLINE_AFTER_MS } from './config.js';
import { localTransport } from './local.js';
import { firebaseTransport } from './firebase.js';

let transport = localTransport;
let ready = false;

let state = null;         // текущее состояние комнаты
let code = null;          // код активной комнаты
let unsubscribe = null;   // отписка от потока обновлений
let detachPresence = null;
let heartbeat = null;

/* --- Личность игрока -------------------------------------- */

export function identity() {
  let id = storage.get('playerId');
  if (!id) id = storage.set('playerId', uid());
  return { id, name: storage.get('playerName', '') };
}

export function setName(name) {
  storage.set('playerName', name.trim().slice(0, 20));
}

/* --- Подключение ------------------------------------------ */

export async function init() {
  if (ready) return transport.name;
  if (isConfigured()) {
    try {
      await firebaseTransport.init();
      transport = firebaseTransport;
    } catch (error) {
      console.warn('[room] Firebase недоступен, работаем локально', error);
      transport = localTransport;
    }
  } else {
    transport = localTransport;
  }
  await transport.init();
  ready = true;
  emit(EV.NET_STATUS, { mode: transport.name });
  return transport.name;
}

export function mode() {
  return transport.name;
}

export function current() {
  return state;
}

export function currentCode() {
  return code;
}

/* --- Жизненный цикл комнаты ------------------------------- */

function makePlayer(name) {
  const me = identity();
  return {
    id: me.id,
    name: name || 'Без имени',
    joinedAt: Date.now(),
    lastSeen: Date.now(),
    online: true
  };
}

export async function createRoom(name, settings = {}) {
  await init();
  const me = identity();
  setName(name);

  const newCode = makeCode(5);
  const initial = {
    code: newCode,
    createdAt: Date.now(),
    hostId: me.id,
    status: 'lobby',
    settings: {
      maxPlayers: settings.maxPlayers || 12,
      discussionSeconds: settings.discussionSeconds || 120
    },
    players: { [me.id]: makePlayer(name) },
    game: null
  };

  await transport.createRoom(newCode, initial);
  await attach(newCode);
  return newCode;
}

export async function joinRoom(rawCode, name) {
  await init();
  const target = String(rawCode || '').trim().toUpperCase();
  if (target.length < 4) throw new Error('Код слишком короткий');

  const found = await transport.getRoom(target);
  if (!found) throw new Error('Комната не найдена. Проверьте код.');

  const me = identity();
  setName(name);
  const existing = found.players?.[me.id];

  if (!existing) {
    const seatCount = Object.keys(found.players || {}).length;
    if (found.status !== 'lobby') throw new Error('Игра уже началась');
    if (seatCount >= (found.settings?.maxPlayers || 12)) throw new Error('Свободных мест нет');
    await transport.update(target, { [`players/${me.id}`]: makePlayer(name) });
  } else {
    // Возвращение: обновляем имя и поднимаем флаг присутствия
    await transport.update(target, {
      [`players/${me.id}/online`]: true,
      [`players/${me.id}/lastSeen`]: Date.now(),
      [`players/${me.id}/name`]: name || existing.name
    });
  }

  await attach(target);
  return target;
}

/** Подписывается на комнату и включает присутствие */
async function attach(target) {
  await detach();
  code = target;
  storage.set('lastRoom', target);

  unsubscribe = transport.subscribe(target, (next) => {
    if (next === undefined) {
      emit(EV.NET_STATUS, { mode: transport.name, lost: true });
      return;
    }
    if (next === null) {
      // Комнату удалили
      state = null;
      emit(EV.ROOM_LEFT, { reason: 'Комната закрыта' });
      return;
    }
    state = normalize(next);
    emit(EV.ROOM_UPDATE, state);
  });

  if (transport.attachPresence) {
    try { detachPresence = await transport.attachPresence(target, identity().id); }
    catch (error) { console.warn('[room] присутствие не включилось', error); }
  }

  startHeartbeat();
}

/** Firebase не хранит пустые объекты — восстанавливаем форму */
function normalize(raw) {
  const room = raw;
  room.players = room.players || {};
  if (room.game) {
    const game = room.game;
    game.chars = game.chars || {};
    game.votes = game.votes || {};
    game.roundReveals = game.roundReveals || {};
    game.eliminated = game.eliminated || [];
    game.log = game.log || [];
    game.order = game.order || Object.keys(room.players);
    for (const character of Object.values(game.chars)) {
      character.revealed = character.revealed || {};
    }
    if (game.bunker) game.bunker.rooms = game.bunker.rooms || [];
  }
  return room;
}

function startHeartbeat() {
  stopHeartbeat();
  heartbeat = setInterval(() => {
    if (!code) return;
    transport.update(code, {
      [`players/${identity().id}/lastSeen`]: Date.now(),
      [`players/${identity().id}/online`]: true
    }).catch(() => {});
  }, HEARTBEAT_MS);
}

function stopHeartbeat() {
  if (heartbeat) clearInterval(heartbeat);
  heartbeat = null;
}

export async function detach() {
  stopHeartbeat();
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  if (detachPresence) { detachPresence(); detachPresence = null; }
  state = null;
  code = null;
}

export async function leaveRoom() {
  if (code) {
    try { await transport.leave(code, identity().id); } catch { /* уже отключены */ }
  }
  storage.remove('lastRoom');
  await detach();
  emit(EV.ROOM_LEFT, { reason: 'Вы покинули комнату' });
}

/** Записывает плоский патч. Все игровые действия идут только через него. */
export async function patch(changes) {
  if (!code) throw new Error('Комната не открыта');
  await transport.update(code, changes);
}

/* --- Вспомогательное -------------------------------------- */

export function isHost(room = state) {
  return Boolean(room && room.hostId === identity().id);
}

export function me(room = state) {
  return room?.players?.[identity().id] || null;
}

/** Игрок считается офлайн, если давно не подавал признаков жизни */
export function isOnline(player) {
  if (!player) return false;
  if (player.online === false) return false;
  if (!player.lastSeen) return true;
  return Date.now() - player.lastSeen < OFFLINE_AFTER_MS;
}

export function savedRoom() {
  return storage.get('lastRoom', null);
}
