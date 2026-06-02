import { PrismaClient } from '@prisma/client';
import { env } from './env';

// ─── Création d'un nouveau client ─────────────────────────────────────────────
function createClient(): PrismaClient {
  return new PrismaClient({
    log: env.IS_DEV ? ['query', 'error', 'warn'] : ['error'],
  });
}

let _prisma = createClient();

// ─── Détection d'une erreur de connexion fermée (Neon timeout) ────────────────
function isClosedError(err: unknown): boolean {
  const msg = String(err).toLowerCase();
  return (
    msg.includes('closed') ||
    msg.includes('econnreset') ||
    msg.includes('econnrefused') ||
    msg.includes('etimedout') ||
    msg.includes('connection')
  );
}

// ─── Reconnexion ──────────────────────────────────────────────────────────────
async function reconnect(): Promise<void> {
  try { await _prisma.$disconnect(); } catch { /* ignore */ }
  _prisma = createClient();
  await _prisma.$connect();
  console.log('[DB] Reconnecté à PostgreSQL (Neon)');
}

// ─── Proxy transparent avec reconnexion automatique ───────────────────────────
// Intercepte tous les appels Prisma : si la connexion est coupée,
// reconnecte et réessaie une fois sans modifier les fichiers service.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop: string) {
    const target = _prisma as unknown as Record<string, unknown>;
    const value  = target[prop];

    if (typeof value !== 'function') return value;

    return (...args: unknown[]) => {
      const result = (value as (...a: unknown[]) => unknown).apply(_prisma, args);

      if (!(result instanceof Promise)) return result;

      return result.catch(async (err: unknown) => {
        if (!isClosedError(err)) throw err;
        // Connexion coupée → reconnexion + 1 retry
        await reconnect();
        const fresh  = (_prisma as unknown as Record<string, unknown>)[prop];
        return (fresh as (...a: unknown[]) => unknown).apply(_prisma, args);
      });
    };
  },
}) as unknown as PrismaClient;

// ─── Helpers ──────────────────────────────────────────────────────────────────
export async function connectDB(): Promise<void> {
  await _prisma.$connect();
  console.log('✅ Connecté à PostgreSQL (Neon)');
}

export async function disconnectDB(): Promise<void> {
  await _prisma.$disconnect();
}
