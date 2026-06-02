"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const path_1 = __importDefault(require("path"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const env_1 = require("./config/env");
const error_middleware_1 = require("./middleware/error.middleware");
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const profile_routes_1 = __importDefault(require("./modules/profile/profile.routes"));
const discovery_routes_1 = __importDefault(require("./modules/discovery/discovery.routes"));
const matches_routes_1 = __importDefault(require("./modules/matches/matches.routes"));
const notifications_routes_1 = __importDefault(require("./modules/notifications/notifications.routes"));
const subscription_routes_1 = __importDefault(require("./modules/subscription/subscription.routes"));
const verification_routes_1 = __importDefault(require("./modules/verification/verification.routes"));
const settings_routes_1 = __importDefault(require("./modules/settings/settings.routes"));
const admin_routes_1 = __importDefault(require("./modules/admin/admin.routes"));
const app = (0, express_1.default)();
// Render (et autres PaaS) utilisent un reverse proxy — on lui fait confiance
// pour que express-rate-limit puisse lire correctement X-Forwarded-For
// trust proxy � Render reverse proxy support
app.set('trust proxy', 1);
// ─── Sécurité ──────────────────────────────────────────
app.use((0, helmet_1.default)({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use((0, cors_1.default)({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Trop de requêtes, réessayez dans 15 minutes' },
});
app.use('/api', limiter);
// ─── Parsing ───────────────────────────────────────────
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// ─── Logs ──────────────────────────────────────────────
if (env_1.env.IS_DEV) {
    app.use((0, morgan_1.default)('dev'));
}
else {
    app.use((0, morgan_1.default)('combined'));
}
// ─── Fichiers statiques (uploads) ──────────────────────
app.use('/uploads', express_1.default.static(path_1.default.join(process.cwd(), env_1.env.UPLOAD_DIR)));
// ─── Page de paiement FedaPay hébergée ─────────────────
// Flutter ouvre cette URL au lieu de sandbox-process.fedapay.com
// (qui bloque les connexions Android)
app.get('/payment', (req, res) => {
    const txId = req.query.txId ?? '';
    const plan = req.query.plan ?? '';
    const amount = req.query.amount ?? '0';
    const pubKey = env_1.env.FEDAPAY_PUBLIC_KEY;
    const apiUrl = env_1.env.API_URL;
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
    const status = req.query.status;
    const plan = req.query.plan;
    const emoji = status === 'success' ? '🎉' : '❌';
    const msg = status === 'success'
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
app.use('/api/auth', auth_routes_1.default);
app.use('/api/profile', profile_routes_1.default);
app.use('/api/discovery', discovery_routes_1.default);
app.use('/api/matches', matches_routes_1.default);
app.use('/api/notifications', notifications_routes_1.default);
app.use('/api/subscription', subscription_routes_1.default);
app.use('/api/verification', verification_routes_1.default);
app.use('/api/settings', settings_routes_1.default);
app.use('/api/admin', admin_routes_1.default);
// ─── Gestion des erreurs ───────────────────────────────
app.use(error_middleware_1.notFoundHandler);
app.use(error_middleware_1.globalErrorHandler);
exports.default = app;
//# sourceMappingURL=app.js.map