import { Router } from 'express';
import {
  sync,
  getMe,
  deleteAccount,
  sendOtpHandler,
  verifyOtpHandler,
} from './auth.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { syncSchema, sendOtpSchema, verifyOtpSchema } from './auth.schemas';

const router = Router();

// ── Firebase sync (email / Google) ────────────────────────────────────────────
router.post('/sync', validate(syncSchema), sync);

// ── OTP par SMS (phone) ───────────────────────────────────────────────────────
router.post('/otp/send', validate(sendOtpSchema), sendOtpHandler);
router.post('/otp/verify', validate(verifyOtpSchema), verifyOtpHandler);

// ── Routes protégées ─────────────────────────────────────────────────────────
router.get('/me', authenticate, getMe);
router.delete('/account', authenticate, deleteAccount);

export default router;
