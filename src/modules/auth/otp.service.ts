import axios from 'axios';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { signToken } from '../../utils/jwt';
import { getFirebaseAuth } from '../../config/firebase';

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS  = 5;

function generateOtpCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export function formatTogoPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('228') && digits.length >= 11) return `+${digits}`;
  if (digits.length === 8) return `+228${digits}`;
  return `+${digits}`;
}

// ── AfrikSMS — GET avec query params (comme le service Laravel officiel) ──────
async function sendSmsAfrik(phone: string, message: string): Promise<void> {
  // Construire l'URL exactement comme le PHP :
  // ?ClientId=...&ApiKey=...&SenderId=...&Message=...&MobileNumbers=...
  const params = new URLSearchParams({
    ClientId:      env.SMS_CLIENT_ID,
    ApiKey:        env.SMS_API_KEY,
    SenderId:      env.SMS_SENDER_ID,
    Message:       message,
    MobileNumbers: phone,
  });

  const url = `${env.SMS_API_URL}?${params.toString()}`;

  console.log('[AfrikSMS] GET →', url.replace(env.SMS_API_KEY, '***'));

  const res = await axios.get(url, {
    timeout:         30000,
    maxRedirects:    10,
    validateStatus:  (s) => s < 500, // ne pas throw sur les 4xx, on les logge
  });

  const httpCode = res.status;
  const data     = res.data;

  console.log('[AfrikSMS] HTTP', httpCode, ':', JSON.stringify(data));

  if (![200, 201].includes(httpCode)) {
    throw new Error(
      `AfrikSMS HTTP ${httpCode}: ${JSON.stringify(data)}`,
    );
  }
}

// ── Envoie un OTP ──────────────────────────────────────────────────────────────
export async function sendOtp(rawPhone: string): Promise<void> {
  const phone = formatTogoPhone(rawPhone);

  // Compte de démo Google Play (App access) : code fixe, pas de vrai SMS —
  // le reviewer n'a pas de ligne togolaise pour recevoir un SMS.
  const isTestAccount = !!env.TEST_ACCOUNT_PHONE && phone === env.TEST_ACCOUNT_PHONE;
  const code           = isTestAccount ? env.TEST_ACCOUNT_OTP_CODE : generateOtpCode();
  const expiresAt      = new Date(Date.now() + OTP_EXPIRY_MS);

  // Invalide les anciens codes
  await prisma.otpCode.updateMany({
    where: { phone, verified: false },
    data:  { expiresAt: new Date(0) },
  });

  await prisma.otpCode.create({ data: { phone, code, expiresAt } });

  // En développement uniquement pour faciliter les tests
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[OTP DEV] ${phone} → ${code}`);
  }

  if (isTestAccount) {
    console.log(`[OTP] Compte de démo Play Store (${phone}) → code fixe, SMS non envoyé`);
    return;
  }

  if (env.SMS_API_KEY && env.SMS_CLIENT_ID) {
    await sendSmsAfrik(
      phone,
      `Votre code Affinity : ${code}\nValable 5 minutes. Ne partagez jamais ce code.`,
    );
  } else {
    console.warn('[OTP] SMS non configuré — code non envoyé pour', phone);
  }
}

// ── Vérifie l'OTP ──────────────────────────────────────────────────────────────
export interface OtpVerifyResult {
  token:             string;
  userId:            string;
  isNewUser:         boolean;
  profileComplete:   boolean;
  firebaseToken?:    string; // custom token Firebase pour Firestore
}

export async function verifyOtp(rawPhone: string, code: string): Promise<OtpVerifyResult> {
  const phone = formatTogoPhone(rawPhone);

  const record = await prisma.otpCode.findFirst({
    where:   { phone, verified: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });

  if (!record) throw new Error('Code expiré. Appuyez sur « Renvoyer ».');
  if (record.attempts >= MAX_ATTEMPTS) {
    await prisma.otpCode.update({ where: { id: record.id }, data: { expiresAt: new Date(0) } });
    throw new Error('Trop de tentatives. Demandez un nouveau code.');
  }
  if (record.code !== code) {
    await prisma.otpCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    throw new Error(`Code incorrect. ${MAX_ATTEMPTS - record.attempts - 1} tentative(s) restante(s).`);
  }

  await prisma.otpCode.update({ where: { id: record.id }, data: { verified: true } });

  const fakeFirebaseUid = `phone_${phone}`;
  let isNewUser = false;

  let user = await prisma.user.findFirst({
    where:   { OR: [{ phone }, { firebaseUid: fakeFirebaseUid }] },
    include: { profile: true, settings: true },
  });

  if (!user) {
    isNewUser = true;
    user = await prisma.user.create({
      data:    { firebaseUid: fakeFirebaseUid, phone, provider: 'phone', settings: { create: {} } },
      include: { profile: true, settings: true },
    });
  }

  const token         = signToken({ userId: user.id, firebaseUid: user.firebaseUid, email: user.email });
  const profileComplete = !!(user as typeof user & { profile: unknown }).profile;

  // Créer un custom token Firebase avec le firebaseUid comme UID
  // Cela permet à l'utilisateur phone de s'authentifier auprès de Firestore
  let firebaseToken: string | undefined;
  try {
    firebaseToken = await getFirebaseAuth().createCustomToken(user.firebaseUid);
  } catch (e) {
    console.warn('[OTP] Impossible de créer le custom token Firebase:', e);
  }

  return { token, userId: user.id, isNewUser, profileComplete, firebaseToken };
}
