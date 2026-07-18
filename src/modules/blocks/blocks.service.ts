import { prisma } from '../../config/prisma';

export async function getBlockedUsers(blockerId: string) {
  const blocks = await prisma.block.findMany({
    where: { blockerId },
    include: {
      blocked: {
        include: { profile: { select: { firstName: true, photos: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return blocks.map((b) => ({
    userId:    b.blockedId,
    firstName: b.blocked.profile?.firstName ?? 'Utilisateur',
    photo:     b.blocked.profile?.photos?.[0] ?? null,
    blockedAt: b.createdAt,
  }));
}

export async function blockUser(blockerId: string, blockedId: string) {
  if (blockerId === blockedId) throw new Error('Impossible de se bloquer soi-même.');
  await prisma.block.upsert({
    where:  { blockerId_blockedId: { blockerId, blockedId } },
    update: {},
    create: { blockerId, blockedId },
  });
}

export async function unblockUser(blockerId: string, blockedId: string) {
  await prisma.block.deleteMany({ where: { blockerId, blockedId } });
}
