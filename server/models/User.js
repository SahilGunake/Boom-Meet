const { getDB } = require('../config/db');

const COLLECTION = 'users';

const User = {
  /**
   * Get the Firestore users collection reference.
   */
  collection() {
    return getDB().collection(COLLECTION);
  },

  /**
   * Find a user by email.
   * @returns {Object|null} user doc with `id` field, or null.
   */
  async findByEmail(email) {
    const snapshot = await this.collection()
      .where('email', '==', email)
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  },

  /**
   * Find a user by document ID.
   * @returns {Object|null} user doc with `id` field, or null.
   */
  async findById(id) {
    const doc = await this.collection().doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  },

  /**
   * Create a new user. Returns the created user object with `id`.
   */
  async create({ name, email, password }) {
    const data = {
      name,
      email,
      password,
      date: new Date().toISOString(),
    };
    const docRef = await this.collection().add(data);
    return { id: docRef.id, ...data };
  },

  /**
   * Store a password-reset token and expiry on a user document.
   */
  async setResetToken(userId, token, expiry) {
    await this.collection().doc(userId).update({
      resetToken: token,
      resetTokenExpiry: expiry,
    });
  },

  /**
   * Find a user by a valid (non-expired) reset token.
   * @returns {Object|null}
   */
  async findByResetToken(token) {
    const snapshot = await this.collection()
      .where('resetToken', '==', token)
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    const data = doc.data();
    // Check expiry
    if (Date.now() > data.resetTokenExpiry) return null;
    return { id: doc.id, ...data };
  },

  /**
   * Update password and clear the reset token fields.
   */
  async updatePassword(userId, hashedPassword) {
    const { FieldValue } = require('firebase-admin/firestore');
    await this.collection().doc(userId).update({
      password: hashedPassword,
      resetToken: FieldValue.delete(),
      resetTokenExpiry: FieldValue.delete(),
    });
  },
};

module.exports = User;
