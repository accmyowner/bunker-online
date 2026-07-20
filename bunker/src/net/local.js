/**
 * local.js — транспорт без сервера.
 *
 * Комнаты живут в памяти вкладки и синхронизируются между вкладками
 * одного браузера через BroadcastChannel. Этого достаточно, чтобы
 * играть на одном устройстве и проверять логику без Firebase.
 */
import { applyPatch } from '../game/engine.js';

const rooms = new Map();      // code -> state
const channels = new Map();   // code -> BroadcastChannel
const watchers = new Map();   // code -> Set<callback>

function channelFor(code) {
  if (channels.has(code)) return channels.get(code);
  const channel = new BroadcastChannel(`bunker:${code}`);
  channel.onmessage = (event) => {
    const message = event.data;
    if (!message) return;

    if (message.type === 'patch') {
      const state = rooms.get(code);
      if (state) {
        applyPatch(state, message.patch);
        notify(code);
      }
    } else if (message.type === 'state') {
      rooms.set(code, message.state);
      notify(code);
    } else if (message.type === 'hello') {
      // Кто-то подключился и просит снимок состояния
      const state = rooms.get(code);
      if (state) channel.postMessage({ type: 'state', state });
    }
  };
  channels.set(code, channel);
  return channel;
}

function notify(code) {
  const state = rooms.get(code);
  for (const callback of watchers.get(code) || []) {
    try { callback(state ? structuredClone(state) : null); }
    catch (error) { console.error('[local] сбой подписчика', error); }
  }
}

export const localTransport = {
  name: 'local',

  async init() { return true; },

  async createRoom(code, state) {
    rooms.set(code, structuredClone(state));
    channelFor(code).postMessage({ type: 'state', state: rooms.get(code) });
    notify(code);
    return true;
  },

  async getRoom(code) {
    const channel = channelFor(code);
    if (rooms.has(code)) return structuredClone(rooms.get(code));

    // Просим снимок у других вкладок и ждём короткое время
    channel.postMessage({ type: 'hello' });
    await new Promise((resolve) => setTimeout(resolve, 260));
    return rooms.has(code) ? structuredClone(rooms.get(code)) : null;
  },

  async update(code, patch) {
    const state = rooms.get(code);
    if (!state) return false;
    applyPatch(state, patch);
    channelFor(code).postMessage({ type: 'patch', patch });
    notify(code);
    return true;
  },

  subscribe(code, callback) {
    if (!watchers.has(code)) watchers.set(code, new Set());
    watchers.get(code).add(callback);
    channelFor(code);
    if (rooms.has(code)) callback(structuredClone(rooms.get(code)));
    return () => {
      watchers.get(code)?.delete(callback);
    };
  },

  async leave(code, playerId) {
    return this.update(code, { [`players/${playerId}/online`]: false });
  }
};
