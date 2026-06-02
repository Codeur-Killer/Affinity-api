import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Lister tous les utilisateurs avec email
  const users = await prisma.user.findMany({
    where:   { email: { not: null } },
    select:  { id: true, email: true, phone: true, provider: true, isAdmin: true },
    orderBy: { createdAt: 'asc' },
    take:    20,
  });

  console.log('\n=== Utilisateurs disponibles ===');
  users.forEach((u, i) => {
    console.log(`${i + 1}. ${u.email ?? u.phone} | provider: ${u.provider} | admin: ${u.isAdmin} | id: ${u.id}`);
  });

  // Rendre admin le premier utilisateur avec email (à changer selon besoin)
  const emailToPromote = process.argv[2];
  if (!emailToPromote) {
    console.log('\n⚠️  Usage: npx tsx scripts/make-admin.ts votre@email.com');
    return;
  }

  const user = await prisma.user.findUnique({ where: { email: emailToPromote } });
  if (!user) {
    console.log(`\n❌ Aucun utilisateur trouvé avec l'email: ${emailToPromote}`);
    return;
  }

  await prisma.user.update({
    where: { email: emailToPromote },
    data:  { isAdmin: true },
  });

  console.log(`\n✅ ${emailToPromote} est maintenant administrateur !`);
  console.log('Tu peux te connecter sur le dashboard admin.\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
