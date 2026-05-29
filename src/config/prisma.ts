import { PrismaClient } from '@prisma/client';
import { env } from './env';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: env.IS_DEV ? ['query', 'error', 'warn'] : ['error'],
  });

if (env.IS_DEV) {
  globalForPrisma.prisma = prisma;
}

export async function connectDB(): Promise<void> {
  await prisma.$connect();
  console.log('✅ Connecté à PostgreSQL (Neon)');
}

export async function disconnectDB(): Promise<void> {
  await prisma.$disconnect();
}
