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

  FEDAPAY_PUBLIC_KEY: z.string().min(1),
  FEDAPAY_SECRET_KEY: z.string().min(20, 'Clé FedaPay trop courte — vérifiez sur app.fedapay.com'),
  FEDAPAY_BASE_URL:   z.string().default('https://api.fedapay.com'),

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
  IS_PROD: parsed.data.NODE_ENV === 'production',
  IS_DEV: parsed.data.NODE_ENV === 'development',
};
