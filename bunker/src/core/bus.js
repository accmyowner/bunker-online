/**
 * bus.js — шина событий приложения.
 * Позволяет модулям общаться, не зная друг о друге.
 */
const listeners = new Map();

export function on(event, handler) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(handler);
  return () => off(event, handler);
}

export function once(event, handler) {
  const stop = on(event, (payload) => { stop(); handler(payload); });
  return stop;
}

export function off(event, handler) {
  listeners.get(event)?.delete(handler);
}

export function emit(event, payload) {
  const set = listeners.get(event);
  if (!set) return;
  for (const handler of Array.from(set)) {
    try { handler(payload); }
    catch (error) { console.error(`[bus] сбой обработчика "${event}"`, error); }
  }
}

/** Названия событий держим в одном месте, чтобы не разъезжались */
export const EV = {
  ROOM_UPDATE:   'room:update',
  ROOM_LEFT:     'room:left',
  NET_STATUS:    'net:status',
  SCREEN_CHANGE: 'screen:change',
  SETTINGS:      'settings:change',
  TOAST:         'ui:toast'
};
