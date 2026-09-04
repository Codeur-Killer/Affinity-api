import { prisma } from '../src/config/prisma';
import { env } from '../src/config/env';

async function main() {
  const phone = env.TEST_ACCOUNT_PHONE || '+22890000000';
  console.log(`[SEED TESTER] Configuration du compte testeur avec le téléphone : ${phone}`);

  const user = await prisma.user.findFirst({
    where: { phone },
    include: { profile: true, subscription: true },
  });

  if (!user) {
    console.error(`[SEED TESTER] Utilisateur avec le numéro ${phone} introuvable.`);
    process.exit(1);
  }

  console.log(`[SEED TESTER] Utilisateur trouvé : ID ${user.id}`);

  // 1. Mettre à jour l'utilisateur en VIP
  await prisma.user.update({
    where: { id: user.id },
    data: { isVip: true },
  });
  console.log(`[SEED TESTER] Utilisateur marqué isVip: true`);

  // 2. Marquer le profil comme vérifié
  if (user.profile) {
    await prisma.profile.update({
      where: { userId: user.id },
      data: { isVerified: true },
    });
    console.log(`[SEED TESTER] Profil marqué isVerified: true`);
  }

  // 3. Upsert de l'abonnement PREMIUM actif jusqu'en 2099
  const expiresAt = new Date('2099-12-31T23:59:59.999Z');
  const sub = await prisma.subscription.upsert({
    where: { userId: user.id },
    update: {
      plan: 'PREMIUM',
      fedapayStatus: 'approved',
      fedapayTxId: 'PLAYSTORE_TESTER',
      expiresAt,
    },
    create: {
      userId: user.id,
      plan: 'PREMIUM',
      fedapayStatus: 'approved',
      fedapayTxId: 'PLAYSTORE_TESTER',
      expiresAt,
    },
  });

  console.log(`[SEED TESTER] Abonnement activé avec succès :`, {
    plan: sub.plan,
    status: sub.fedapayStatus,
    expiresAt: sub.expiresAt,
  });

  console.log('[SEED TESTER] Terminé avec succès !');
}

main()
  .catch((err) => {
    console.error('[SEED TESTER] Erreur :', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
