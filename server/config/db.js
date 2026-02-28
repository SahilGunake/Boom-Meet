const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

let db;

const connectDB = () => {
  try {
    const serviceAccount = {
      type: 'service_account',
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID || '',
      private_key: process.env.FIREBASE_PRIVATE_KEY || '',
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID || '',
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
    };

    initializeApp({
      credential: cert(serviceAccount),
    });

    db = getFirestore();
    console.log(`Firestore Connected (project: ${process.env.FIREBASE_PROJECT_ID})`);
  } catch (err) {
    console.error(`Firestore connection error: ${err.message}`);
    process.exit(1);
  }
};

const getDB = () => {
  if (!db) throw new Error('Firestore not initialized. Call connectDB() first.');
  return db;
};

module.exports = { connectDB, getDB };
