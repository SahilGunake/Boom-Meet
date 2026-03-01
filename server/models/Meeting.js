const { getDB } = require('../config/db');

const COLLECTION = 'meetings';

const Meeting = {
  collection() {
    return getDB().collection(COLLECTION);
  },

  /**
   * Find a meeting by its roomId.
   * @returns {Object|null} meeting doc with `id` field, or null.
   */
  async findByRoomId(roomId) {
    const snapshot = await this.collection()
      .where('roomId', '==', roomId)
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  },

  /**
   * Create a new meeting.
   * @param {Object} data - { roomId, hostId, hostName, password (hashed or null), title, createdAt }
   * @returns {Object} created meeting with `id`.
   */
  async create(data) {
    const doc = {
      roomId: data.roomId,
      hostId: data.hostId,
      hostName: data.hostName || '',
      title: data.title || 'Untitled Meeting',
      password: data.password || null, // bcrypt hash or null
      isActive: true,
      participants: [],
      createdAt: new Date().toISOString(),
    };
    const docRef = await this.collection().add(doc);
    return { id: docRef.id, ...doc };
  },

  /**
   * End a meeting (mark inactive).
   */
  async endMeeting(roomId) {
    const meeting = await this.findByRoomId(roomId);
    if (!meeting) return null;
    await this.collection().doc(meeting.id).update({
      isActive: false,
      endedAt: new Date().toISOString(),
    });
    return meeting;
  },

  /**
   * Add a participant to the meeting's participant list.
   */
  async addParticipant(roomId, userId, userName) {
    const meeting = await this.findByRoomId(roomId);
    if (!meeting) return null;
    const { FieldValue } = require('firebase-admin/firestore');
    await this.collection().doc(meeting.id).update({
      participants: FieldValue.arrayUnion({ userId, userName, joinedAt: new Date().toISOString() }),
    });
  },
};

module.exports = Meeting;
