/**
 * config.js — параметры подключения к Firebase.
 *
 * Вставьте сюда данные своего проекта: Firebase → Настройки проекта →
 * Ваши приложения → Web. Нужен Realtime Database, а не Firestore.
 *
 * Пока поля пустые, игра работает в локальном режиме: комнаты живут
 * между вкладками одного браузера. Это удобно, чтобы проверить
 * интерфейс и правила, не поднимая бэкенд.
 */
export const FIREBASE_CONFIG = {
apiKey: "AIzaSyDMUt97g0gdLC7iYJA4BEyDIblsrRt3PI0",
authDomain: "bunker-online-9013d.firebaseapp.com",
databaseURL: "https://bunker-online-9013d-default-rtdb.europe-west1.firebasedatabase.app",
projectId: "bunker-online-9013d",
storageBucket: "bunker-online-9013d.firebasestorage.app",
messagingSenderId: "465949636166",
appId: "1:465949636166:web:850b2af663b0197c413ea7"
};

/** Версия SDK, подтягиваемого с CDN. Ничего не собираем локально. */
export const FIREBASE_SDK = 'https://www.gstatic.com/firebasejs/10.12.2';

/** Настроен ли Firebase */
export function isConfigured() {
  return Boolean(FIREBASE_CONFIG.databaseURL && FIREBASE_CONFIG.apiKey);
}

/** Комната считается заброшенной и удаляется через это время */
export const ROOM_TTL_MS = 6 * 60 * 60 * 1000;

/** Как часто отмечаем, что игрок на связи */
export const HEARTBEAT_MS = 15000;

/** Через сколько молчания игрок считается отключившимся */
export const OFFLINE_AFTER_MS = 45000;
