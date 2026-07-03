import { Plan } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { getCurrentSubscription } from './subscription.service';

export interface PlanLimits {
  dailyLikes: number | null;       // null = illimité
  dailySuperLikes: number | null;  // null = illimité
  boostsPerMonth: number | null;   // null = illimité
  canSeeWhoLikedYou: boolean;
  canUseIncognito: boolean;
  advancedFilters: boolean;
  secretProfile: boolean;
  prioritySupport: boolean;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  DECOUVERTE: {
    dailyLikes: 25,
    dailySuperLikes: 0,
    boostsPerMonth: 0,
    canSeeWhoLikedYou: true,
    canUseIncognito: false,
    advancedFilters: false,
    secretProfile: false,
    prioritySupport: false,
  },
  STANDARD: {
    dailyLikes: null,
    dailySuperLikes: 5,
    boostsPerMonth: 1,
    canSeeWhoLikedYou: true,
    canUseIncognito: true,
    advancedFilters: true,
    secretProfile: false,
    prioritySupport: false,
  },
  PREMIUM: {
    dailyLikes: null,
    dailySuperLikes: null,
    boostsPerMonth: null,
    canSeeWhoLikedYou: true,
    canUseIncognito: true,
    advancedFilters: true,
    secretProfile: true,
    prioritySupport: true,
  },
};

export interface AccessStatus {
  plan: Plan | null;
  isActive: boolean;
  isVerified: boolean;
  canSwipe: boolean;
  limits: PlanLimits;
  usage: {
    likesToday: number;
    superLikesToday: number;
    boostsThisMonth: number;
  };
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

const NO_PLAN_LIMITS: PlanLimits = {
  dailyLikes: 0,
  dailySuperLikes: 0,
  boostsPerMonth: 0,
  canSeeWhoLikedYou: false,
  canUseIncognito: false,
  advancedFilters: false,
  secretProfile: false,
  prioritySupport: false,
};

export async function getAccessStatus(userId: string): Promise<AccessStatus> {
  const [sub, profile, likesToday, superLikesToday, boostsThisMonth] = await Promise.all([
    getCurrentSubscription(userId),
    prisma.profile.findUnique({ where: { userId }, select: { isVerified: true } }),
    prisma.like.count({
      where: { senderId: userId, isSuperLike: false, createdAt: { gte: startOfToday() } },
    }),
    prisma.like.count({
      where: { senderId: userId, isSuperLike: true, createdAt: { gte: startOfToday() } },
    }),
    prisma.boost.count({
      where: { userId, startedAt: { gte: startOfMonth() } },
    }),
  ]);

  const isActive = sub ? sub.expiresAt > new Date() && sub.fedapayStatus === 'approved' : false;
  const isVerified = profile?.isVerified ?? false;
  const limits = isActive && sub ? PLAN_LIMITS[sub.plan] : NO_PLAN_LIMITS;

  return {
    plan: isActive ? (sub?.plan ?? null) : null,
    isActive,
    isVerified,
    canSwipe: isActive && isVerified,
    limits,
    usage: { likesToday, superLikesToday, boostsThisMonth },
  };
}
