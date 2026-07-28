/**
 * chat.js — общий игровой чат комнаты.
 *
 * Сообщения хранятся в состоянии комнаты под ключом chat/<id> и
 * синхронизируются тем же механизмом патчей, что и игровые действия
 * (room.patch → transport.update → ROOM_UPDATE). Поэтому сеть,
 * комнаты и синхронизация не меняются — чат просто ещё одна ветка
 * данных внутри комнаты.
 *
 * Личных данных здесь нет: заметки живут отдельно и только локально.
 */
import * as room from '../../net/room.js';

const MAX_LEN = 200;
const MIN_INTERVAL_MS = 1000;   // не чаще одного сообщения в секунду
const KEEP_LAST = 100;          // храним последние N сообщений

let lastSentAt = 0;

/** Короткий уникальный id сообщения (время + случайность для порядка) */
function messageId() {
  const t = Date.now().toString(36);
  const r = Math.floor(Math.random() * 1e6).toString(36);
  return `${t}_${r}`;
}

/**
 * Отправка сообщения. Возвращает { ok } или { ok:false, reason }.
 * Валидация: непустое, не длиннее лимита, не чаще секунды.
 */
export async function sendMessage(rawText) {
  const text = String(rawText || '').trim();
  if (!text) return { ok: false, reason: 'empty' };
  if (text.length > MAX_LEN) return { ok: false, reason: 'too_long' };

  const now = Date.now();
  if (now - lastSentAt < MIN_INTERVAL_MS) return { ok: false, reason: 'rate' };

  const me = room.identity();
  const id = messageId();
  const message = {
    id,
    name: me.name || 'Игрок',
    uid: me.id,
    text,
    t: now
  };

  lastSentAt = now;
  try {
    await room.patch({ [`chat/${id}`]: message });
    return { ok: true };
  } catch (error) {
    lastSentAt = 0;          // не засчитываем неудачную отправку
    return { ok: false, reason: 'network' };
  }
}

/** Достаёт сообщения из состояния комнаты, отсортированные по времени */
export function readMessages(state) {
  const chat = state?.chat;
  if (!chat) return [];
  return Object.values(chat)
    .filter((m) => m && m.text)
    .sort((a, b) => (a.t || 0) - (b.t || 0))
    .slice(-KEEP_LAST);
}

export const CHAT_MAX_LEN = MAX_LEN;
