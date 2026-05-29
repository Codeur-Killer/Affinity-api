import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { unauthorized } from '../utils/response';

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    unauthorized(res, 'Token manquant ou invalide');
    return;
  }

  const token = header.split(' ')[1];

  try {
    const payload = verifyToken(token);
    req.user = {
      id: payload.userId,
      firebaseUid: payload.firebaseUid,
      email: payload.email,
    };
    next();
  } catch {
    unauthorized(res, 'Token expiré ou invalide');
  }
}
