import { prisma }          from '../../config/prisma';
import { getFirebaseAuth } from '../../config/firebase';

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

// ── Gestion des administrateurs ───────────────────────────────────────────────

export async function listAdmins() {
  return prisma.user.findMany({
    where:   { isAdmin: true },
    select:  { id: true, email: true, phone: true, createdAt: true, provider: true },
    orderBy: { createdAt: 'asc' },
  });
}

export async function createAdmin(
  email:    string,
  password: string,
  displayName?: string,
) {
  const existing = await prisma.user.findFirst({ where: { email } });
  if (existing) {
    if (existing.isAdmin) throw new Error('Ce compte est déjà administrateur');
    // Promote existing user
    await getFirebaseAuth().setCustomUserClaims(existing.firebaseUid, { isAdmin: true }).catch(() => {});
    return prisma.user.update({
      where:  { id: existing.id },
      data:   { isAdmin: true },
      select: { id: true, email: true, isAdmin: true, createdAt: true },
    });
  }

  // Create new Firebase user
  const fbUser = await getFirebaseAuth().createUser({
    email,
    password,
    displayName: displayName ?? email.split('@')[0],
  });

  // Create backend user
  return prisma.user.create({
    data: {
      firebaseUid: fbUser.uid,
      email,
      provider:    'email',
      isAdmin:     true,
    },
    select: { id: true, email: true, isAdmin: true, createdAt: true },
  });
}

export async function removeAdmin(userId: string, selfId: string) {
  if (userId === selfId) throw new Error('Vous ne pouvez pas retirer vos propres droits');
  return prisma.user.update({
    where:  { id: userId },
    data:   { isAdmin: false },
    select: { id: true, email: true, isAdmin: true },
  });
}

// ── Retraits VIP ──────────────────────────────────────────────────────────────

export async function listVipWithdrawals(status?: string) {
  const where = status ? { status } : {};
  const withdrawals = await prisma.vipWithdrawal.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      vipUser: {
        select: {
          email: true,
          phone: true,
          vipCode: true,
          profile: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });
  return withdrawals;
}

export async function reviewWithdrawal(
  id:      string,
  status:  'approved' | 'rejected',
  note?:   string,
) {
  const w = await prisma.vipWithdrawal.findUnique({ where: { id } });
  if (!w) throw new Error('Retrait introuvable');
  if (w.status !== 'pending') throw new Error('Ce retrait a déjà été traité');
  return prisma.vipWithdrawal.update({
    where: { id },
    data:  { status, note: note ?? null, updatedAt: new Date() },
  });
}

// ── Graphique inscriptions (7 derniers jours) — requête unique ────────────────
export async function getRegistrationChart() {
  const days  = 7;
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const rows = await prisma.$queryRaw<{ day: Date; count: bigint }[]>`
    SELECT DATE_TRUNC('day', created_at) AS day, COUNT(*) AS count
    FROM users
    WHERE created_at >= ${since}
    GROUP BY day
    ORDER BY day ASC
  `;

  const countByDay = new Map(
    rows.map((r) => [r.day.toISOString().slice(0, 10), Number(r.count)]),
  );

  return Array.from({ length: days }, (_, i) => {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key  = d.toISOString().slice(0, 10);
    return {
      date:  d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' }),
      users: countByDay.get(key) ?? 0,
    };
  });
}
