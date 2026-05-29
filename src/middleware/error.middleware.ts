import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} introuvable`,
  });
}

export function globalErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error(`[ERROR] ${req.method} ${req.originalUrl}`, err.message);

  res.status(500).json({
    success: false,
    message: 'Erreur interne du serveur',
    ...(env.IS_DEV && { stack: err.stack }),
  });
}
