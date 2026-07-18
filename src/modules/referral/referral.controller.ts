import { Request, Response } from 'express';
import { ok, badRequest } from '../../utils/response';
import { getReferralStats, useReferralCode } from './referral.service';

export async function getStats(req: Request, res: Response) {
  const stats = await getReferralStats(req.user!.id);
  ok(res, stats);
}

export async function applyCode(req: Request, res: Response) {
  const { code } = req.body as { code?: string };
  if (!code?.trim()) { badRequest(res, 'Code requis'); return; }
  const result = await useReferralCode(req.user!.id, code.trim().toUpperCase());
  if (!result.success) { badRequest(res, result.message); return; }
  ok(res, { message: result.message });
}
