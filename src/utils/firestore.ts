import { getFirestore } from '../config/firebase';
import { v4 as uuidv4 } from 'uuid';

export async function createFirestoreConversation(
  matchId: string,
  user1Id: string,
  user2Id: string,
): Promise<string> {
  const db = getFirestore();
  const conversationId = uuidv4();

  await db.collection('conversations').doc(conversationId).set({
    matchId,
    participants: [user1Id, user2Id],
    createdAt: new Date(),
    lastMessage: null,
    unreadCount: { [user1Id]: 0, [user2Id]: 0 },
  });

  return conversationId;
}

export async function sendFirestoreMessage(
  conversationId: string,
  senderId: string,
  text: string,
  type: 'text' | 'image' = 'text',
): Promise<void> {
  const db = getFirestore();
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

export async function sendFirestorePushNotification(
  fcmToken: string,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  try {
    const admin = await import('firebase-admin');
    await admin.default.messaging().send({
      token: fcmToken,
      notification: { title, body },
      data,
      android: {
        priority:             'high',
        notification: {
          channelId:   'affinity_notifications',
          sound:       'default',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
        },
      },
      apns: { payload: { aps: { sound: 'default' } } },
    });
  } catch {
    // Ne pas bloquer l'opération si la notif échoue
  }
}
