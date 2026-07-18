import { prisma } from '../../config/prisma';

export async function getVipDashboard(userId: string) {
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { vipCode: true, isVip: true },
  });

  if (!user?.isVip || !user.vipCode) {
    throw new Error('Compte VIP introuvable');
  }

  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [referrals, referralsThisMonth] = await Promise.all([
    prisma.vipReferral.findMany({
      where:   { vipUserId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        // Récupérer le prénom de l'abonné
      },
    }),
    prisma.vipReferral.count({
      where: { vipUserId: userId, createdAt: { gte: firstDayOfMonth } },
    }),
  ]);

  // Récupérer les prénoms des abonnés
  const subscriberIds = referrals.map((r) => r.subscriberUserId);
  const subscribers   = await prisma.profile.findMany({
    where:  { userId: { in: subscriberIds } },
    select: { userId: true, firstName: true },
  });
  const nameMap = Object.fromEntries(subscribers.map((p) => [p.userId, p.firstName]));

  const totalCommissions  = referrals.reduce((s, r) => s + r.commission, 0);
  const monthCommissions  = referrals
    .filter((r) => r.createdAt >= firstDayOfMonth)
    .reduce((s, r) => s + r.commission, 0);

  const history = referrals.map((r) => ({
    subscriberName: nameMap[r.subscriberUserId] ?? 'Utilisateur',
    plan:           r.plan,
    commission:     r.commission,
    date:           r.createdAt,
  }));

  return {
    vipCode:           user.vipCode,
    totalReferrals:    referrals.length,
    referralsThisMonth,
    totalCommissions,
    monthCommissions,
    history,
  };
}
