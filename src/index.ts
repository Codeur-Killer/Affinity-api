import 'dotenv/config';
import { env } from './config/env';
import { connectDB, disconnectDB, prisma } from './config/prisma';
import { initFirebase } from './config/firebase';
import { initCloudinary } from './config/cloudinary';
import app from './app';
import fs from 'fs';
import path from 'path';

async function bootstrap(): Promise<void> {
  // Créer les dossiers d'upload s'ils n'existent pas
  const uploadDirs = [
    path.join(env.UPLOAD_DIR, 'photos'),
    path.join(env.UPLOAD_DIR, 'verification'),
  ];
  uploadDirs.forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  // Initialiser Firebase Admin SDK
  try {
    initFirebase();
  } catch {
    console.warn('⚠️  Firebase Admin non initialisé (configurez FIREBASE_* dans .env)');
  }

  // Initialiser Cloudinary (avant le démarrage du serveur)
  initCloudinary();

  // Connexion à la base de données
  await connectDB();

  // Démarrer le serveur sur 0.0.0.0 (accessible depuis l'émulateur Android)
  const server = app.listen(env.PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Affinity API démarrée`);
    console.log(`   URL locale  : http://localhost:${env.PORT}`);
    console.log(`   URL Android : http://10.0.2.2:${env.PORT}  (émulateur)`);
    console.log(`   Env         : ${env.NODE_ENV}`);
    console.log(`   Health      : http://localhost:${env.PORT}/health\n`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n🛑 Arrêt du serveur...');
    server.close(async () => {
      await disconnectDB();
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
      await prisma.$queryRaw`SELECT 1`;
    } catch (e) {
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
