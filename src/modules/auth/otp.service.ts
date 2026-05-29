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
async function sendSmsAfrik(phone: string, message: string): Promise<{ sent: boolean; error?: string }> {
  const bodyJson = JSON.stringify({
    client_id:    Number(env.SMS_CLIENT_ID),
    sender_id:    env.SMS_SENDER_ID,
    msisdn:       phone,
    msg:          message,
    phone_number: phone,
    to:           phone,
    message,
  });

  // Essai 1 : JSON + Api-Key header
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
    return { sent: true };
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      const detail = JSON.stringify(err.response?.data ?? err.message);
      console.error(`[AfrikSMS] HTTP ${status} : ${detail}`);

      // Essai 2 : form-encoded si l'API attend ce format
      if (status !== 401) {
        try {
          const params = new URLSearchParams({
            client_id: env.SMS_CLIENT_ID,
            sender_id: env.SMS_SENDER_ID,
            msisdn: phone,
            msg: message,
          });
          const res2 = await axios.post(env.SMS_API_URL, params.toString(), {
            headers: {
              'Api-Key':      env.SMS_API_KEY,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            timeout: 8000,
          });
          console.log('[AfrikSMS] ✅ form OK HTTP', res2.status, JSON.stringify(res2.data));
          return { sent: true };
        } catch (err2) {
          const d = axios.isAxiosError(err2)
            ? `HTTP ${err2.response?.status}: ${JSON.stringify(err2.response?.data ?? err2.message)}`
            : String(err2);
          console.error('[AfrikSMS] form attempt:', d);
        }
      }

      if (status === 401) {
        return {
          sent:  false,
          error: 'Clé API AfrikSMS invalide (401). Régénérez votre clé sur https://app.afriksms.com/',
        };
      }
      return { sent: false, error: `AfrikSMS HTTP ${status}: ${detail}` };
    }
    return { sent: false, error: String(err) };
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

  // Sauvegarde le nouveau code en base
  await prisma.otpCode.create({ data: { phone, code, expiresAt } });

  // Toujours visible dans les logs (essentiel pour le debug)
  console.log('\n' + '='.repeat(50));
  console.log(`📱 [OTP] Numéro : ${phone}`);
  console.log(`🔑 [OTP] Code   : ${code}  (valable 5 min)`);
  console.log('='.repeat(50) + '\n');

  // Tentative d'envoi SMS
  const result = await sendSmsAfrik(
    phone,
    `Votre code Affinity : ${code}\nValable 5 min. Ne partagez jamais ce code.`,
  );

  if (!result.sent) {
    // SMS non envoyé → l'utilisateur peut lire le code dans les logs du serveur
    // En production, le code ci-dessous devrait lever une erreur
    // En dev, on continue pour que le flow soit testable
    console.warn('\n⚠️  SMS non envoyé — utilisez le code dans les logs ci-dessus');
    console.warn(`⚠️  Cause : ${result.error}`);
    console.warn('⚠️  → Vérifiez votre clé AfrikSMS sur https://app.afriksms.com/\n');

    // En production, décommenter cette ligne pour bloquer si SMS échoue :
    // throw new Error('Impossible d\'envoyer le SMS. Vérifiez vos identifiants AfrikSMS.');
  }
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
