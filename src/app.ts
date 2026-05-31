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

// ─── Page de paiement FedaPay hébergée ─────────────────
// Flutter ouvre cette URL au lieu de sandbox-process.fedapay.com
// (qui bloque les connexions Android)
app.get('/payment', (req, res) => {
  const txId    = req.query.txId    as string ?? '';
  const plan    = req.query.plan    as string ?? '';
  const amount  = req.query.amount  as string ?? '0';
  const pubKey  = env.FEDAPAY_PUBLIC_KEY;
  const apiUrl  = env.API_URL;

  res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <title>Paiement Affinity</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0F0B1E;
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card {
      background: #1a1030;
      border-radius: 24px;
      padding: 36px 28px;
      max-width: 380px;
      width: 100%;
      text-align: center;
      border: 1px solid rgba(108,71,255,0.3);
      margin: 20px;
    }
    .logo { font-size: 28px; font-weight: 800; margin-bottom: 4px;
      background: linear-gradient(135deg, #6C47FF, #FF6B8A);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .subtitle { color: rgba(255,255,255,0.5); font-size: 13px; margin-bottom: 28px; }
    .amount { font-size: 36px; font-weight: 800; margin-bottom: 4px; }
    .plan { color: rgba(255,255,255,0.6); font-size: 14px; margin-bottom: 28px; }
    #pay-btn {
      width: 100%;
      background: linear-gradient(135deg, #6C47FF, #FF6B8A);
      color: white;
      border: none;
      padding: 16px;
      border-radius: 14px;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    #pay-btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .secure { color: rgba(255,255,255,0.35); font-size: 12px; margin-top: 16px; }
    .spinner { display: none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">Affinity</div>
    <div class="subtitle">Paiement sécurisé</div>
    <div class="amount">${parseInt(amount).toLocaleString('fr-FR')} FCFA</div>
    <div class="plan">Abonnement ${plan}</div>
    <button id="pay-btn">💳 Payer maintenant</button>
    <p class="secure">🔒 Paiement sécurisé par FedaPay</p>
  </div>

  <script src="https://cdn.fedapay.com/checkout.js?v=1.1.7"></script>
  <script>
    FedaPay.init('#pay-btn', {
      public_key: '${pubKey}',
      transaction: { id: ${txId} },
      onComplete: function(resp) {
        if (resp.reason === FedaPay.DIALOG_DISMISSED) {
          window.location.href = '${apiUrl}/api/subscription/result?status=cancel&plan=${plan}';
        } else {
          window.location.href = '${apiUrl}/api/subscription/result?status=success&plan=${plan}&txId=${txId}';
        }
      }
    });
  </script>
</body>
</html>`);
});

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
