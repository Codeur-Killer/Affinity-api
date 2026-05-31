import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { forbidden } from '../utils/response';

/** Vérifie que l'utilisateur authentifié est un administrateur */
export async function requireAdmin(
  req:  Request,
  res:  Response,
  next: NextFunction,
): Promise<void> {
  const userId = req.user?.id;
  if (!userId) { forbidden(res, 'Non authentifié'); return; }

  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { isAdmin: true },
  });

  if (!user?.isAdmin) {
    forbidden(res, 'Accès réservé aux administrateurs');
    return;
  }
  next();
}
