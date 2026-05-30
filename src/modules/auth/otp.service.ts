import axios from 'axios';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { signToken } from '../../utils/jwt';

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

// ── Envoi SMS via AfrikSMS ────────────────────────────────────────────────────
async function sendSmsAfrik(phone: string, message: string): Promise<void> {
  const bodyJson = {
    client_id:    Number(env.SMS_CLIENT_ID),
    sender_id:    env.SMS_SENDER_ID,
    msisdn:       phone,
    msg:          message,
    phone_number: phone,
    to:           phone,
    message,
  };

  console.log('[AfrikSMS] Envoi vers', phone, '| URL:', env.SMS_API_URL);

  // Tentative 1 : JSON
  try {
    const res = await axios.post(env.SMS_API_URL, bodyJson, {
      headers: {
        'Api-Key':       env.SMS_API_KEY,
        'Authorization': `Bearer ${env.SMS_API_KEY}`,
        'Content-Type':  'application/json',
      },
      timeout: 12000,
    });
    console.log('[AfrikSMS] ✅ HTTP', res.status, JSON.stringify(res.data));
    return;
  } catch (err) {
    if (!axios.isAxiosError(err)) throw err;

    const status = err.response?.status;
    const data   = err.response?.data;
    console.error('[AfrikSMS] ❌ HTTP', status, JSON.stringify(data ?? err.message));

    // Tentative 2 : form-encoded (si le serveur rejette le JSON)
    if (status !== 401 && status !== 403) {
      try {
        const params = new URLSearchParams({
          client_id: env.SMS_CLIENT_ID,
          sender_id: env.SMS_SENDER_ID,
          msisdn:    phone,
          msg:       message,
        });
        const r2 = await axios.post(env.SMS_API_URL, params.toString(), {
          headers: {
            'Api-Key':      env.SMS_API_KEY,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 10000,
        });
        console.log('[AfrikSMS] ✅ form-encoded OK HTTP', r2.status, JSON.stringify(r2.data));
        return;
      } catch (err2) {
        const d = axios.isAxiosError(err2)
          ? `HTTP ${err2.response?.status}: ${JSON.stringify(err2.response?.data)}`
          : String(err2);
        console.error('[AfrikSMS] ❌ form-encoded aussi échoué:', d);
      }
    }

    // Construire un message d'erreur clair
    if (status === 401 || status === 403) {
      throw new Error(
        'Clé API AfrikSMS invalide ou non autorisée. ' +
        'Vérifiez SMS_API_KEY dans les variables d\'environnement Render.',
      );
    }
    throw new Error(`AfrikSMS HTTP ${status}: ${JSON.stringify(data)}`);
  }
}

// ── Envoie un OTP ─────────────────────────────────────────────────────────────
export async function sendOtp(rawPhone: string): Promise<void> {
  const phone     = formatTogoPhone(rawPhone);
  const code      = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

  // Invalide les anciens codes
  await prisma.otpCode.updateMany({
    where: { phone, verified: false },
    data:  { expiresAt: new Date(0) },
  });

  // Sauvegarde le code en base
  await prisma.otpCode.create({ data: { phone, code, expiresAt } });

  // Log toujours visible (développement + debug production)
  console.log('\n' + '='.repeat(50));
  console.log(`📱 OTP pour ${phone} : ${code}  (5 min)`);
  console.log('='.repeat(50) + '\n');

  // Envoi SMS — bloquant : si ça échoue, l'utilisateur est informé
  await sendSmsAfrik(
    phone,
    `Votre code Affinity : ${code}\nValable 5 minutes. Ne partagez jamais ce code.`,
  );
}

// ── Vérifie l'OTP ─────────────────────────────────────────────────────────────
export interface OtpVerifyResult {
  token:           string;
  userId:          string;
  isNewUser:       boolean;
  profileComplete: boolean;
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
    await prisma.otpCode.update({
      where: { id: record.id },
      data:  { attempts: { increment: 1 } },
    });
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

  const token = signToken({ userId: user.id, firebaseUid: user.firebaseUid, email: user.email });
  const profileComplete = !!(user as typeof user & { profile: unknown }).profile;
  return { token, userId: user.id, isNewUser, profileComplete };
}
