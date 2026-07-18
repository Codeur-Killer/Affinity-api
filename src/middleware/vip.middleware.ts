import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { forbidden } from '../utils/response';

export async function requireVip(
  req:  Request,
  res:  Response,
  next: NextFunction,
): Promise<void> {
  const userId = req.user?.id;
  if (!userId) { forbidden(res, 'Non authentifié'); return; }

  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { isVip: true },
  });

  if (!user?.isVip) {
    forbidden(res, 'Accès réservé aux comptes VIP');
    return;
  }
  next();
}
