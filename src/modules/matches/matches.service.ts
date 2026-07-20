import { prisma } from '../../config/prisma';

const MATCHES_PAGE_SIZE = 30;

export async function getMyMatches(userId: string, page = 1) {
  const skip = (page - 1) * MATCHES_PAGE_SIZE;
  const where = { OR: [{ user1Id: userId }, { user2Id: userId }] };
  const [matches, total] = await Promise.all([
    prisma.match.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: MATCHES_PAGE_SIZE,
      include: {
        user1: { include: { profile: true } },
        user2: { include: { profile: true } },
      },
    }),
    prisma.match.count({ where }),
  ]);

  const data = matches.map((m) => {
    const other = m.user1Id === userId ? m.user2 : m.user1;
    return {
      matchId: m.id,
      conversationId: m.conversationId,
      createdAt: m.createdAt,
      user: { id: other.id, profile: other.profile },
    };
  });

  return { matches: data, total, page, hasMore: skip + matches.length < total };
}

export async function getMatchById(matchId: string, userId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      user1: { include: { profile: true } },
      user2: { include: { profile: true } },
    },
  });

  if (!match) return null;
  if (match.user1Id !== userId && match.user2Id !== userId) return null;

  const other = match.user1Id === userId ? match.user2 : match.user1;
  return {
    matchId: match.id,
    conversationId: match.conversationId,
    createdAt: match.createdAt,
    user: { id: other.id, profile: other.profile },
  };
}

export async function unmatch(matchId: string, userId: string): Promise<boolean> {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) return false;
  if (match.user1Id !== userId && match.user2Id !== userId) return false;

  await prisma.match.delete({ where: { id: matchId } });
  return true;
}
