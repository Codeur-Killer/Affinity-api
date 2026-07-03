"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const zod_1 = require("zod");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const envSchema = zod_1.z.object({
    PORT: zod_1.z.string().default('3000'),
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    API_URL: zod_1.z.string().default('http://localhost:3000'),
    DATABASE_URL: zod_1.z.string(),
    DIRECT_URL: zod_1.z.string().optional(),
    JWT_SECRET: zod_1.z.string().min(16),
    JWT_EXPIRES_IN: zod_1.z.string().default('30d'),
    FIREBASE_PROJECT_ID: zod_1.z.string(),
    FIREBASE_CLIENT_EMAIL: zod_1.z.string(),
    FIREBASE_PRIVATE_KEY: zod_1.z.string(),
    CINETPAY_API_KEY: zod_1.z.string().min(1),
    CINETPAY_SECRET_KEY: zod_1.z.string().min(1),
    CINETPAY_SITE_ID: zod_1.z.string().min(1),
    PLAN_PRICE_DECOUVERTE: zod_1.z.string().default('5000'),
    PLAN_PRICE_STANDARD: zod_1.z.string().default('15000'),
    PLAN_PRICE_PREMIUM: zod_1.z.string().default('25000'),
    UPLOAD_DIR: zod_1.z.string().default('uploads'),
    MAX_FILE_SIZE_MB: zod_1.z.string().default('10'),
    SMS_API_URL: zod_1.z.string().default('https://api.afriksms.com/api/web/web_v1/outbounds/send'),
    SMS_API_KEY: zod_1.z.string(),
    SMS_CLIENT_ID: zod_1.z.string(),
    SMS_SENDER_ID: zod_1.z.string().default('Affinity'),
    CLOUDINARY_CLOUD_NAME: zod_1.z.string(),
    CLOUDINARY_API_KEY: zod_1.z.string(),
    CLOUDINARY_API_SECRET: zod_1.z.string(),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    console.error('❌ Variables d\'environnement invalides:');
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
}
exports.env = {
    ...parsed.data,
    PORT: parseInt(parsed.data.PORT, 10),
    MAX_FILE_SIZE_BYTES: parseInt(parsed.data.MAX_FILE_SIZE_MB, 10) * 1024 * 1024,
    PLAN_PRICE_DECOUVERTE: parseInt(parsed.data.PLAN_PRICE_DECOUVERTE, 10),
    PLAN_PRICE_STANDARD: parseInt(parsed.data.PLAN_PRICE_STANDARD, 10),
    PLAN_PRICE_PREMIUM: parseInt(parsed.data.PLAN_PRICE_PREMIUM, 10),
    IS_PROD: parsed.data.NODE_ENV === 'production',
    IS_DEV: parsed.data.NODE_ENV === 'development',
};
//# sourceMappingURL=env.js.map