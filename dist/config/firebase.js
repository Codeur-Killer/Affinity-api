"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initFirebase = initFirebase;
exports.getFirebaseAuth = getFirebaseAuth;
exports.getFirestore = getFirestore;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const env_1 = require("./env");
let firebaseApp;
function initFirebase() {
    if (firebase_admin_1.default.apps.length > 0) {
        firebaseApp = firebase_admin_1.default.apps[0];
        return firebaseApp;
    }
    const privateKey = env_1.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
    firebaseApp = firebase_admin_1.default.initializeApp({
        credential: firebase_admin_1.default.credential.cert({
            projectId: env_1.env.FIREBASE_PROJECT_ID,
            clientEmail: env_1.env.FIREBASE_CLIENT_EMAIL,
            privateKey,
        }),
    });
    console.log('✅ Firebase Admin SDK initialisé');
    return firebaseApp;
}
function getFirebaseAuth() {
    return firebase_admin_1.default.auth();
}
function getFirestore() {
    return firebase_admin_1.default.firestore();
}
//# sourceMappingURL=firebase.js.map