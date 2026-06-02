"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const env_1 = require("./config/env");
const prisma_1 = require("./config/prisma");
const firebase_1 = require("./config/firebase");
const cloudinary_1 = require("./config/cloudinary");
const app_1 = __importDefault(require("./app"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
async function bootstrap() {
    // Créer les dossiers d'upload s'ils n'existent pas
    const uploadDirs = [
        path_1.default.join(env_1.env.UPLOAD_DIR, 'photos'),
        path_1.default.join(env_1.env.UPLOAD_DIR, 'verification'),
    ];
    uploadDirs.forEach((dir) => {
        if (!fs_1.default.existsSync(dir))
            fs_1.default.mkdirSync(dir, { recursive: true });
    });
    // Initialiser Firebase Admin SDK
    try {
        (0, firebase_1.initFirebase)();
    }
    catch {
        console.warn('⚠️  Firebase Admin non initialisé (configurez FIREBASE_* dans .env)');
    }
    // Initialiser Cloudinary (avant le démarrage du serveur)
    (0, cloudinary_1.initCloudinary)();
    // Connexion à la base de données
    await (0, prisma_1.connectDB)();
    // Démarrer le serveur sur 0.0.0.0 (accessible depuis l'émulateur Android)
    const server = app_1.default.listen(env_1.env.PORT, '0.0.0.0', () => {
        console.log(`\n🚀 Affinity API démarrée`);
        console.log(`   URL locale  : http://localhost:${env_1.env.PORT}`);
        console.log(`   URL Android : http://10.0.2.2:${env_1.env.PORT}  (émulateur)`);
        console.log(`   Env         : ${env_1.env.NODE_ENV}`);
        console.log(`   Health      : http://localhost:${env_1.env.PORT}/health\n`);
    });
    // Graceful shutdown
    const shutdown = async () => {
        console.log('\n🛑 Arrêt du serveur...');
        server.close(async () => {
            await (0, prisma_1.disconnectDB)();
            console.log('✅ Serveur arrêté proprement');
            process.exit(0);
        });
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    // ── Keep-alive : ping Neon toutes les 4 min pour éviter la déconnexion ──────
    // Neon suspend les connexions après ~5 min d'inactivité.
    setInterval(async () => {
        try {
            await prisma_1.prisma.$queryRaw `SELECT 1`;
        }
        catch (e) {
            console.warn('[DB] Keep-alive échoué, reconnexion en cours...', String(e).slice(0, 80));
        }
    }, 4 * 60 * 1000);
}
bootstrap().catch((err) => {
    console.error('❌ Erreur au démarrage:', err);
    process.exit(1);
});
// ── Protection globale contre les crashes ──────────────────────────────────────
// Neon peut émettre des erreurs de connexion en dehors des requêtes actives.
// Sans ces handlers, Node.js s'arrête et Render redémarre le serveur.
process.on('uncaughtException', (err) => {
    console.error('[ERREUR NON GÉRÉE]', err.message);
});
process.on('unhandledRejection', (reason) => {
    console.error('[REJET NON GÉRÉ]', String(reason).slice(0, 200));
});
//# sourceMappingURL=index.js.map