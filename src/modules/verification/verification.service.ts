import { prisma } from '../../config/prisma';
import { Verification } from '@prisma/client';

export async function getVerificationStatus(userId: string): Promise<Verification | null> {
  return prisma.verification.findUnique({ where: { userId } });
}

export async function submitIdCard(
  userId: string,
  idFrontUrl: string,
  idBackUrl: string,
): Promise<Verification> {
  return prisma.verification.upsert({
    where: { userId },
    update: { idFrontUrl, idBackUrl, status: 'PENDING' },
    create: { userId, idFrontUrl, idBackUrl },
  });
}

export async function submitSelfie(userId: string, selfieUrl: string): Promise<Verification> {
  return prisma.verification.upsert({
    where: { userId },
    update: { selfieUrl, status: 'PENDING' },
    create: { userId, selfieUrl },
  });
}
