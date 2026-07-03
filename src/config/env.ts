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

  CINETPAY_API_KEY:    z.string().min(1),
  CINETPAY_SECRET_KEY: z.string().min(1),
  CINETPAY_SITE_ID:    z.string().min(1),

  PLAN_PRICE_DECOUVERTE: z.string().default('5000'),
  PLAN_PRICE_STANDARD:   z.string().default('15000'),
  PLAN_PRICE_PREMIUM:    z.string().default('25000'),

  UPLOAD_DIR: z.string().default('uploads'),
  MAX_FILE_SIZE_MB: z.string().default('10'),

  SMS_API_URL: z.string().default('https://api.afriksms.com/api/web/web_v1/outbounds/send'),
  SMS_API_KEY: z.string(),
  SMS_CLIENT_ID: z.string(),
  SMS_SENDER_ID: z.string().default('Affinity'),

  CLOUDINARY_CLOUD_NAME: z.string(),
  CLOUDINARY_API_KEY: z.string(),
  CLOUDINARY_API_SECRET: z.string(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Variables d\'environnement invalides:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  PORT: parseInt(parsed.data.PORT, 10),
  MAX_FILE_SIZE_BYTES: parseInt(parsed.data.MAX_FILE_SIZE_MB, 10) * 1024 * 1024,
  PLAN_PRICE_DECOUVERTE: parseInt(parsed.data.PLAN_PRICE_DECOUVERTE, 10),
  PLAN_PRICE_STANDARD:   parseInt(parsed.data.PLAN_PRICE_STANDARD,   10),
  PLAN_PRICE_PREMIUM:    parseInt(parsed.data.PLAN_PRICE_PREMIUM,     10),
  IS_PROD: parsed.data.NODE_ENV === 'production',
  IS_DEV: parsed.data.NODE_ENV === 'development',
};
