import { prisma } from '../../config/prisma';

// Code parrainage : AFFINITY- + 8 premiers chars de userId en majuscules
export function buildReferralCode(userId: string): string {
  return `AFFINITY-${userId.substring(0, 8).toUpperCase()}`;
}

// Retrouver l'auteur d'un code
async function findReferrer(code: string): Promise<string | null> {
  const prefix = code.toUpperCase().replace('AFFINITY-', '');
  const users = await prisma.user.findMany({ select: { id: true } });
  const match = users.find(
    (u) => u.id.substring(0, 8).toUpperCase() === prefix,
  );
  return match?.id ?? null;
}

export async function useReferralCode(
  referredUserId: string,
  code: string,
): Promise<{ success: boolean; message: string }> {
  // Un utilisateur ne peut être parrainé qu'une fois
  const existing = await prisma.referral.findUnique({
    where: { referredUserId },
  });
  if (existing) return { success: false, message: 'Vous avez déjà utilisé un code.' };

  const referrerId = await findReferrer(code);
  if (!referrerId) return { success: false, message: 'Code invalide.' };
  if (referrerId === referredUserId) return { success: false, message: 'Vous ne pouvez pas utiliser votre propre code.' };

  await prisma.referral.create({
    data: { referrerId, referredUserId, rewardAmount: 1500 },
  });

  return { success: true, message: 'Code appliqué ! Votre parrain recevra 1 500 FCFA.' };
}

export async function getReferralStats(userId: string): Promise<{
  code:   string;
  count:  number;
  gains:  number;
}> {
  const referrals = await prisma.referral.findMany({
    where: { referrerId: userId },
  });

  return {
    code:  buildReferralCode(userId),
    count: referrals.length,
    gains: referrals.reduce((sum, r) => sum + r.rewardAmount, 0),
  };
}
