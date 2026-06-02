"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.connectDB = connectDB;
exports.disconnectDB = disconnectDB;
const client_1 = require("@prisma/client");
const env_1 = require("./env");
// ─── Création d'un nouveau client ─────────────────────────────────────────────
function createClient() {
    return new client_1.PrismaClient({
        log: env_1.env.IS_DEV ? ['query', 'error', 'warn'] : ['error'],
    });
}
let _prisma = createClient();
// ─── Détection d'une erreur de connexion fermée (Neon timeout) ────────────────
function isClosedError(err) {
    const msg = String(err).toLowerCase();
    return (msg.includes('closed') ||
        msg.includes('econnreset') ||
        msg.includes('econnrefused') ||
        msg.includes('etimedout') ||
        msg.includes('connection'));
}
// ─── Reconnexion ──────────────────────────────────────────────────────────────
async function reconnect() {
    try {
        await _prisma.$disconnect();
    }
    catch { /* ignore */ }
    _prisma = createClient();
    await _prisma.$connect();
    console.log('[DB] Reconnecté à PostgreSQL (Neon)');
}
// ─── Proxy transparent avec reconnexion automatique ───────────────────────────
// Intercepte tous les appels Prisma : si la connexion est coupée,
// reconnecte et réessaie une fois sans modifier les fichiers service.
exports.prisma = new Proxy({}, {
    get(_target, prop) {
        const target = _prisma;
        const value = target[prop];
        if (typeof value !== 'function')
            return value;
        return (...args) => {
            const result = value.apply(_prisma, args);
            if (!(result instanceof Promise))
                return result;
            return result.catch(async (err) => {
                if (!isClosedError(err))
                    throw err;
                // Connexion coupée → reconnexion + 1 retry
                await reconnect();
                const fresh = _prisma[prop];
                return fresh.apply(_prisma, args);
            });
        };
    },
});
// ─── Helpers ──────────────────────────────────────────────────────────────────
async function connectDB() {
    await _prisma.$connect();
    console.log('✅ Connecté à PostgreSQL (Neon)');
}
async function disconnectDB() {
    await _prisma.$disconnect();
}
//# sourceMappingURL=prisma.js.map