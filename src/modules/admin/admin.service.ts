import { prisma } from '../../config/prisma';

// ── Statistiques globales ──────────────────────────────────────────────────────
export async function getStats() {
  const [
    totalUsers,
    activeUsers,
    totalProfiles,
    verifiedProfiles,
    pendingVerifications,
    totalMatches,
    activeSubscriptions,
    decouverte,
    standard,
    premium,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.profile.count({ where: { isActive: true } }),
    prisma.profile.count(),
    prisma.profile.count({ where: { isVerified: true } }),
    prisma.verification.count({ where: { status: 'PENDING' } }),
    prisma.match.count(),
    prisma.subscription.count({
      where: { fedapayStatus: 'approved', expiresAt: { gt: new Date() } },
    }),
    prisma.subscription.count({ where: { plan: 'DECOUVERTE', fedapayStatus: 'approved', expiresAt: { gt: new Date() } } }),
    prisma.subscription.count({ where: { plan: 'STANDARD',   fedapayStatus: 'approved', expiresAt: { gt: new Date() } } }),
    prisma.subscription.count({ where: { plan: 'PREMIUM',    fedapayStatus: 'approved', expiresAt: { gt: new Date() } } }),
  ]);

  const revenue = decouverte * 5000 + standard * 15000 + premium * 25000;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const newUsersThisMonth = await prisma.user.count({
    where: { createdAt: { gte: thirtyDaysAgo } },
  });

  return {
    users:                { total: totalUsers, active: activeUsers, newThisMonth: newUsersThisMonth },
    profiles:             { total: totalProfiles, verified: verifiedProfiles, pendingVerification: pendingVerifications },
    matches:              { total: totalMatches },
    subscriptions:        { active: activeSubscriptions, decouverte, standard, premium },
    revenue:              { total: revenue, fcfa: `${revenue.toLocaleString('fr-FR')} FCFA` },
  };
}

// ── Gestion des utilisateurs ───────────────────────────────────────────────────
export async function getUsers(page = 1, limit = 20, search = '') {
  const skip  = (page - 1) * limit;
  const where = search
    ? {
        OR: [
          { email:   { contains: search, mode: 'insensitive' as const } },
          { phone:   { contains: search } },
          { profile: { firstName: { contains: search, mode: 'insensitive' as const } } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take:    limit,
      orderBy: { createdAt: 'desc' },
      include: {
        profile:      { select: { firstName: true, lastName: true, isVerified: true, isActive: true, photos: true } },
        subscription: { select: { plan: true, fedapayStatus: true, expiresAt: true } },
        _count:       { select: { matches1: true, matches2: true, sentLikes: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users: users.map((u) => ({
      id:           u.id,
      email:        u.email,
      phone:        u.phone,
      provider:     u.provider,
      isAdmin:      u.isAdmin,
      createdAt:    u.createdAt,
      profile:      u.profile,
      subscription: u.subscription,
      matchCount:   (u._count.matches1 ?? 0) + (u._count.matches2 ?? 0),
      likeCount:    u._count.sentLikes ?? 0,
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

export async function banUser(userId: string, banned: boolean) {
  return prisma.profile.update({
    where: { userId },
    data:  { isActive: !banned },
  });
}

export async function promoteUser(userId: string, isAdmin: boolean) {
  return prisma.user.update({
    where: { id: userId },
    data:  { isAdmin },
  });
}

// ── Vérifications d'identité ──────────────────────────────────────────────────
export async function getPendingVerifications(page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const [verifs, total] = await Promise.all([
    prisma.verification.findMany({
      where:   { status: 'PENDING', idFrontUrl: { not: null }, selfieUrl: { not: null } },
      skip,
      take:    limit,
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          include: {
            profile: { select: { firstName: true, lastName: true, birthdate: true, photos: true } },
          },
        },
      },
    }),
    prisma.verification.count({
      where: { status: 'PENDING', idFrontUrl: { not: null } },
    }),
  ]);

  return {
    verifications: verifs,
    pagination:    { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

export async function reviewVerification(
  userId:   string,
  approved: boolean,
) {
  const status = approved ? 'APPROVED' : 'REJECTED';

  await prisma.$transaction([
    prisma.verification.update({
      where: { userId },
      data:  { status, reviewedAt: new Date() },
    }),
    prisma.profile.update({
      where: { userId },
      data:  { isVerified: approved },
    }),
  ]);

  return { userId, status, isVerified: approved };
}

// ── Abonnements ────────────────────────────────────────────────────────────────
export async function getSubscriptions(page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const [subs, total] = await Promise.all([
    prisma.subscription.findMany({
      skip,
      take:    limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          include: {
            profile: { select: { firstName: true, lastName: true } },
          },
        },
      },
    }),
    prisma.subscription.count(),
  ]);

  return {
    subscriptions: subs,
    pagination:    { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

// ── Gestion des VIP ───────────────────────────────────────────────────────────

export async function listVips() {
  const vips = await prisma.user.findMany({
    where:   { isVip: true },
    select: {
      id:      true,
      email:   true,
      phone:   true,
      vipCode: true,
      createdAt: true,
      profile: { select: { firstName: true, lastName: true } },
      vipCommissions: {
        select: { commission: true, createdAt: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return vips.map((u) => ({
    id:               u.id,
    email:            u.email,
    phone:            u.phone,
    vipCode:          u.vipCode,
    firstName:        u.profile?.firstName,
    lastName:         u.profile?.lastName,
    createdAt:        u.createdAt,
    totalReferrals:   u.vipCommissions.length,
    totalCommissions: u.vipCommissions.reduce((s, r) => s + r.commission, 0),
  }));
}

export async function createVip(userId: string, vipCode: string) {
  const code     = vipCode.toUpperCase();
  const existing = await prisma.user.findUnique({ where: { vipCode: code } });
  if (existing) throw new Error(`Le code VIP "${code}" est déjà utilisé`);

  return prisma.user.update({
    where:  { id: userId },
    data:   { isVip: true, vipCode: code },
    select: { id: true, email: true, vipCode: true, isVip: true },
  });
}

export async function updateVip(
  userId: string,
  data:   { vipCode?: string; isVip?: boolean },
) {
  if (data.vipCode) {
    const code     = data.vipCode.toUpperCase();
    const existing = await prisma.user.findFirst({
      where: { vipCode: code, id: { not: userId } },
    });
    if (existing) throw new Error(`Le code VIP "${code}" est déjà utilisé`);
    data.vipCode = code;
  }
  return prisma.user.update({
    where:  { id: userId },
    data:   {
      ...(data.vipCode !== undefined && { vipCode: data.vipCode }),
      ...(data.isVip  !== undefined && { isVip:  data.isVip  }),
    },
    select: { id: true, email: true, vipCode: true, isVip: true },
  });
}

export async function revokeVip(userId: string) {
  return prisma.user.update({
    where:  { id: userId },
    data:   { isVip: false, vipCode: null },
    select: { id: true, email: true, vipCode: true, isVip: true },
  });
}

// ── Graphique inscriptions (7 derniers jours) ─────────────────────────────────
export async function getRegistrationChart() {
  const days = 7;
  const data = [];
  for (let i = days - 1; i >= 0; i--) {
    const start = new Date();
    start.setDate(start.getDate() - i);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);

    const count = await prisma.user.count({
      where: { createdAt: { gte: start, lte: end } },
    });
    data.push({
      date:  start.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' }),
      users: count,
    });
  }
  return data;
}
