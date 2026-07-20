import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_URL: z.string().default('http://localhost:3000'),

  DATABASE_URL: z.string(),
  DIRECT_URL: z.string().optional(),

  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('30d'),

  FIREBASE_PROJECT_ID: z.string(),
  FIREBASE_CLIENT_EMAIL: z.string(),
  FIREBASE_PRIVATE_KEY: z.string(),

  FEDAPAY_SECRET_KEY: z.string().min(1),
  FEDAPAY_PUBLIC_KEY: z.string().optional(),

  PLAN_PRICE_DECOUVERTE: z.string().default('5000'),
  PLAN_PRICE_STANDARD:   z.string().default('15000'),
  PLAN_PRICE_PREMIUM:    z.string().default('25000'),
  VIP_COMMISSION_FCFA:   z.string().default('950'),

  UPLOAD_DIR: z.string().default('uploads'),
  MAX_FILE_SIZE_MB: z.string().default('10'),

  SMS_API_URL: z.string().default('https://api.afriksms.com/api/web/web_v1/outbounds/send'),
  SMS_API_KEY: z.string().optional(),
  SMS_CLIENT_ID: z.string().optional(),
  SMS_SENDER_ID: z.string().default('Affinity'),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Variables d\'environnement invalides:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

// Avertissements pour les services optionnels non configurés
const d = parsed.data;
const missing: string[] = [];
if (!d.SMS_API_KEY || !d.SMS_CLIENT_ID)                                    missing.push('SMS (OTP par SMS désactivé)');
if (!d.CLOUDINARY_CLOUD_NAME || !d.CLOUDINARY_API_KEY || !d.CLOUDINARY_API_SECRET) missing.push('Cloudinary (photos désactivées)');
if (d.FIREBASE_PROJECT_ID === 'your-project-id')                           missing.push('Firebase credentials (notifications FCM désactivées)');
if (d.JWT_SECRET === 'change_this_to_a_long_random_string')                missing.push('JWT_SECRET sécurisé');
if (missing.length) {
  console.warn('\n⚠️  Variables d\'environnement manquantes ou placeholders:');
  missing.forEach((m) => console.warn(`   • ${m}`));
  console.warn('   → Configurer ces variables avant la mise en production.\n');
}

export const env = {
  ...parsed.data,
  PORT: parseInt(parsed.data.PORT, 10),
  MAX_FILE_SIZE_BYTES: parseInt(parsed.data.MAX_FILE_SIZE_MB, 10) * 1024 * 1024,
  PLAN_PRICE_DECOUVERTE: parseInt(parsed.data.PLAN_PRICE_DECOUVERTE, 10),
  PLAN_PRICE_STANDARD:   parseInt(parsed.data.PLAN_PRICE_STANDARD,   10),
  PLAN_PRICE_PREMIUM:    parseInt(parsed.data.PLAN_PRICE_PREMIUM,     10),
  VIP_COMMISSION_FCFA:   parseInt(parsed.data.VIP_COMMISSION_FCFA,    10),
  IS_PROD: parsed.data.NODE_ENV === 'production',
  IS_DEV: parsed.data.NODE_ENV === 'development',
};
