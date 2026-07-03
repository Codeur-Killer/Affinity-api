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
import adminRoutes from './modules/admin/admin.routes';

const app = express();

// Render (et autres PaaS) utilisent un reverse proxy — on lui fait confiance
// pour que express-rate-limit puisse lire correctement X-Forwarded-For
// trust proxy � Render reverse proxy support
app.set('trust proxy', 1);

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


// ─── Page résultat paiement (interceptée par Flutter) ──
app.get('/api/subscription/result', (req, res) => {
  const status = req.query.status as string;
  const plan   = req.query.plan   as string;
  const emoji  = status === 'success' ? '🎉' : '❌';
  const msg    = status === 'success'
    ? 'Paiement réussi ! Retournez dans l\'application Affinity.'
    : 'Paiement annulé. Retournez dans l\'application Affinity.';
  res.send(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${emoji} Affinity</title>
    <style>body{background:#0F0B1E;color:white;font-family:sans-serif;display:flex;
    align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:20px;}
    h2{font-size:28px;margin:12px 0;}p{color:rgba(255,255,255,0.6);}</style>
  </head><body>
    <div><div style="font-size:56px">${emoji}</div>
    <h2>${status === 'success' ? 'Paiement réussi !' : 'Annulé'}</h2>
    <p>${msg}</p></div>
  </body></html>`);
});

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
app.use('/api/admin',   adminRoutes);

// ─── Gestion des erreurs ───────────────────────────────
app.use(notFoundHandler);
app.use(globalErrorHandler);

export default app;
