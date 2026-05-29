import admin from 'firebase-admin';
import { env } from './env';

let firebaseApp: admin.app.App;

export function initFirebase(): admin.app.App {
  if (admin.apps.length > 0) {
    firebaseApp = admin.apps[0]!;
    return firebaseApp;
  }

  const privateKey = env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });

  console.log('✅ Firebase Admin SDK initialisé');
  return firebaseApp;
}

export function getFirebaseAuth(): admin.auth.Auth {
  return admin.auth();
}

export function getFirestore(): admin.firestore.Firestore {
  return admin.firestore();
}
