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

  const [referrals, referralsThisMonth, withdrawals] = await Promise.all([
    prisma.vipReferral.findMany({
      where:   { vipUserId: userId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.vipReferral.count({
      where: { vipUserId: userId, createdAt: { gte: firstDayOfMonth } },
    }),
    prisma.vipWithdrawal.findMany({
      where:   { vipUserId: userId },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const subscriberIds = referrals.map((r) => r.subscriberUserId);
  const subscribers   = await prisma.profile.findMany({
    where:  { userId: { in: subscriberIds } },
    select: { userId: true, firstName: true },
  });
  const nameMap = Object.fromEntries(subscribers.map((p) => [p.userId, p.firstName]));

  const totalCommissions = referrals.reduce((s, r) => s + r.commission, 0);
  const monthCommissions = referrals
    .filter((r) => r.createdAt >= firstDayOfMonth)
    .reduce((s, r) => s + r.commission, 0);

  const totalWithdrawn = withdrawals
    .filter((w) => w.status === 'approved' || w.status === 'pending')
    .reduce((s, w) => s + w.amount, 0);

  const availableBalance = Math.max(0, totalCommissions - totalWithdrawn);

  return {
    vipCode:           user.vipCode,
    totalReferrals:    referrals.length,
    referralsThisMonth,
    totalCommissions,
    monthCommissions,
    availableBalance,
    history: referrals.map((r) => ({
      subscriberName: nameMap[r.subscriberUserId] ?? 'Utilisateur',
      plan:           r.plan,
      commission:     r.commission,
      date:           r.createdAt,
    })),
    withdrawals: withdrawals.map((w) => ({
      id:        w.id,
      amount:    w.amount,
      status:    w.status,
      note:      w.note,
      createdAt: w.createdAt,
    })),
  };
}

export async function requestWithdrawal(userId: string, amount: number) {
  if (!amount || amount <= 0) throw new Error('Montant invalide');

  const [referrals, existingWithdrawals] = await Promise.all([
    prisma.vipReferral.findMany({ where: { vipUserId: userId }, select: { commission: true } }),
    prisma.vipWithdrawal.findMany({
      where:  { vipUserId: userId, status: { in: ['pending', 'approved'] } },
      select: { amount: true },
    }),
  ]);

  const totalEarned    = referrals.reduce((s, r) => s + r.commission, 0);
  const totalReserved  = existingWithdrawals.reduce((s, w) => s + w.amount, 0);
  const available      = totalEarned - totalReserved;

  if (amount > available) {
    throw new Error(`Solde insuffisant. Disponible : ${available.toLocaleString('fr-FR')} FCFA`);
  }

  return prisma.vipWithdrawal.create({
    data: { vipUserId: userId, amount, status: 'pending' },
  });
}

export async function getMyWithdrawals(userId: string) {
  return prisma.vipWithdrawal.findMany({
    where:   { vipUserId: userId },
    orderBy: { createdAt: 'desc' },
  });
}
