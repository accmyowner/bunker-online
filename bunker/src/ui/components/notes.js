/**
 * notes.js — личные заметки игрока.
 *
 * Полностью локальные: хранятся в localStorage и НИКОГДА не
 * отправляются в Firebase и не попадают в состояние комнаты.
 * Их не видит никто, кроме самого игрока на этом устройстве.
 *
 * Заметки привязаны к коду комнаты, чтобы у разных партий были
 * свои записи, а не одна общая простыня.
 */
import * as storage from '../../core/storage.js';

function keyFor(code) {
  return `notes:${code || 'global'}`;
}

/** Читает заметки для комнаты */
export function readNotes(code) {
  return storage.get(keyFor(code), '');
}

/** Сохраняет заметки (вызывается на каждый ввод) */
export function writeNotes(code, text) {
  storage.set(keyFor(code), String(text || ''));
}

/** Очищает заметки этой комнаты */
export function clearNotes(code) {
  storage.remove(keyFor(code));
}
