/**
 * firebase.js — транспорт поверх Realtime Database.
 *
 * SDK подгружается с CDN по требованию, поэтому в бандле его нет
 * и локальный режим ничего лишнего не тянет.
 *
 * Правила безопасности для базы (Firebase → Realtime Database → Rules):
 * {
 *   "rules": {
 *     "rooms": {
 *       "$code": {
 *         ".read": true,
 *         ".write": true,
 *         ".validate": "newData.hasChildren(['code'])"
 *       }
 *     }
 *   }
 * }
 * Для продакшена стоит добавить анонимную авторизацию и ограничить
 * запись полями своего игрока.
 */
import { FIREBASE_CONFIG, FIREBASE_SDK, isConfigured } from './config.js';

let db = null;
let api = null;

async function loadSdk() {
  if (api) return api;
  const [app, database] = await Promise.all([
    import(`${FIREBASE_SDK}/firebase-app.js`),
    import(`${FIREBASE_SDK}/firebase-database.js`)
  ]);
  api = { ...app, ...database };
  return api;
}

const roomPath = (code) => `rooms/${code}`;

export const firebaseTransport = {
  name: 'firebase',

  async init() {
    if (!isConfigured()) throw new Error('Firebase не настроен');
    const sdk = await loadSdk();
    const app = sdk.getApps().length ? sdk.getApp() : sdk.initializeApp(FIREBASE_CONFIG);
    db = sdk.getDatabase(app);
    return true;
  },

  async createRoom(code, state) {
    await api.set(api.ref(db, roomPath(code)), state);
    return true;
  },

  async getRoom(code) {
    const snapshot = await api.get(api.ref(db, roomPath(code)));
    return snapshot.exists() ? snapshot.val() : null;
  },

  /** Плоский патч ложится в multi-path update без гонок за соседние поля */
  async update(code, patch) {
    const scoped = {};
    for (const [path, value] of Object.entries(patch)) {
      scoped[`${roomPath(code)}/${path}`] = value;
    }
    await api.update(api.ref(db), scoped);
    return true;
  },

  subscribe(code, callback) {
    const reference = api.ref(db, roomPath(code));
    const handler = api.onValue(
      reference,
      (snapshot) => callback(snapshot.exists() ? snapshot.val() : null),
      (error) => {
        console.error('[firebase] подписка оборвалась', error);
        callback(undefined); // undefined = соединение потеряно, состояние неизвестно
      }
    );
    return () => api.off(reference, 'value', handler);
  },

  /**
   * Присутствие: при обрыве связи Firebase сам пометит игрока офлайн.
   * Именно это делает переподключение безболезненным — данные
   * игрока остаются в комнате, меняется только флаг online.
   */
  async attachPresence(code, playerId) {
    const onlineRef = api.ref(db, `${roomPath(code)}/players/${playerId}/online`);
    const seenRef = api.ref(db, `${roomPath(code)}/players/${playerId}/lastSeen`);

    await api.onDisconnect(onlineRef).set(false);
    await api.onDisconnect(seenRef).set(api.serverTimestamp());
    await api.set(onlineRef, true);

    const connectedRef = api.ref(db, '.info/connected');
    const stop = api.onValue(connectedRef, async (snapshot) => {
      if (snapshot.val() !== true) return;
      // Соединение восстановлено — заново вешаем onDisconnect и поднимаем флаг
      await api.onDisconnect(onlineRef).set(false);
      await api.set(onlineRef, true);
    });

    return () => api.off(connectedRef, 'value', stop);
  },

  async leave(code, playerId) {
    await this.update(code, {
      [`players/${playerId}/online`]: false,
      [`players/${playerId}/lastSeen`]: Date.now()
    });
  }
};
