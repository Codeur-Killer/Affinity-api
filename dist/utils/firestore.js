"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFirestoreConversation = createFirestoreConversation;
exports.sendFirestoreMessage = sendFirestoreMessage;
exports.sendFirestorePushNotification = sendFirestorePushNotification;
const firebase_1 = require("../config/firebase");
const uuid_1 = require("uuid");
async function createFirestoreConversation(matchId, user1Id, user2Id) {
    const db = (0, firebase_1.getFirestore)();
    const conversationId = (0, uuid_1.v4)();
    await db.collection('conversations').doc(conversationId).set({
        matchId,
        participants: [user1Id, user2Id],
        createdAt: new Date(),
        lastMessage: null,
        unreadCount: { [user1Id]: 0, [user2Id]: 0 },
    });
    return conversationId;
}
async function sendFirestoreMessage(conversationId, senderId, text, type = 'text') {
    const db = (0, firebase_1.getFirestore)();
    const messageRef = db
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .doc();
    const now = new Date();
    const message = {
        id: messageRef.id,
        senderId,
        text,
        type,
        createdAt: now,
        readAt: null,
    };
    await messageRef.set(message);
    await db.collection('conversations').doc(conversationId).update({
        lastMessage: { text, senderId, createdAt: now },
    });
}
async function sendFirestorePushNotification(fcmToken, title, body, data) {
    try {
        const admin = await Promise.resolve().then(() => __importStar(require('firebase-admin')));
        await admin.default.messaging().send({
            token: fcmToken,
            notification: { title, body },
            data,
            android: { priority: 'high' },
            apns: { payload: { aps: { sound: 'default' } } },
        });
    }
    catch {
        // Ne pas bloquer l'opération si la notif échoue
    }
}
//# sourceMappingURL=firestore.js.map