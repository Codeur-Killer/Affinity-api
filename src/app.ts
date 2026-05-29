import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { notFoundHandler, globalErrorHandler } from './middleware/error.middleware';

import authRoutes from './modules/auth/auth.routes';
import profileRoutes from './modules/profile/profile.routes';
import discoveryRoutes from './modules/discovery/discovery.routes';
import matchesRoutes from './modules/matches/matches.routes';
import notificationsRoutes from './modules/notifications/notifications.routes';
import subscriptionRoutes from './modules/subscription/subscription.routes';
import verificationRoutes from './modules/verification/verification.routes';
import settingsRoutes from './modules/settings/settings.routes';

const app = express();

// ─── Sécurité ──────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Trop de requêtes, réessayez dans 15 minutes' },
});
app.use('/api', limiter);

// ─── Parsing ───────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Logs ──────────────────────────────────────────────
if (env.IS_DEV) {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// ─── Fichiers statiques (uploads) ──────────────────────
app.use('/uploads', express.static(path.join(process.cwd(), env.UPLOAD_DIR)));

// ─── Health check ──────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// ─── Routes API ────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/discovery', discoveryRoutes);
app.use('/api/matches', matchesRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/settings', settingsRoutes);

// ─── Gestion des erreurs ───────────────────────────────
app.use(notFoundHandler);
app.use(globalErrorHandler);

export default app;
