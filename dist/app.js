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