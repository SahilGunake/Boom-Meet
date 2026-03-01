const session = require('express-session');
const { getDB } = require('./db');

const COLLECTION = 'sessions';
const ONE_DAY_MS = 86400000;

/**
 * Deep-clone an object into a plain Object tree that Firestore can serialize.
 * JSON round-trip strips custom prototypes (Session, Cookie, etc.).
 */
function toPlain(obj) {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    return {};
  }
}

/**
 * A lightweight express-session store backed by Firestore.
 * Stores sessions in a `sessions` collection with auto-expiry cleanup.
 */
class FirestoreSessionStore extends session.Store {
  constructor(options = {}) {
    super(options);
    this.ttl = options.ttl || ONE_DAY_MS;
  }

  _col() {
    return getDB().collection(COLLECTION);
  }

  get(sid, callback) {
    try {
      this._col()
        .doc(sid)
        .get()
        .then((doc) => {
          if (!doc.exists) return callback(null, null);
          const data = doc.data();
          if (data.expiresAt && data.expiresAt < Date.now()) {
            this.destroy(sid, () => {});
            return callback(null, null);
          }
          callback(null, data.session || null);
        })
        .catch((err) => callback(err));
    } catch (err) {
      callback(err);
    }
  }

  set(sid, sessionData, callback) {
    try {
      const maxAge =
        (sessionData && sessionData.cookie && sessionData.cookie.maxAge) ||
        this.ttl;
      const expiresAt = Date.now() + maxAge;

      // Firestore rejects objects with custom prototypes (Session, Cookie).
      // JSON round-trip produces a tree of plain Objects only.
      const plain = toPlain(sessionData);

      this._col()
        .doc(sid)
        .set({ session: plain, expiresAt })
        .then(() => callback && callback(null))
        .catch((err) => {
          console.error('[SessionStore] set error (async):', err.message);
          callback && callback(err);
        });
    } catch (err) {
      console.error('[SessionStore] set error (sync):', err.message);
      if (callback) callback(err);
    }
  }

  destroy(sid, callback) {
    try {
      this._col()
        .doc(sid)
        .delete()
        .then(() => callback && callback(null))
        .catch((err) => callback && callback(err));
    } catch (err) {
      if (callback) callback(err);
    }
  }

  touch(sid, sessionData, callback) {
    try {
      const maxAge =
        (sessionData && sessionData.cookie && sessionData.cookie.maxAge) ||
        this.ttl;
      const expiresAt = Date.now() + maxAge;

      this._col()
        .doc(sid)
        .set({ expiresAt }, { merge: true })
        .then(() => callback && callback(null))
        .catch((err) => callback && callback(err));
    } catch (err) {
      if (callback) callback(err);
    }
  }
}

module.exports = FirestoreSessionStore;
