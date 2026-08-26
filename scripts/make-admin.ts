// Promotes an existing customer account to admin. There is no web-facing way
// to become an admin (signup always creates isAdmin: false) — this script is
// the only path, so becoming an admin always requires direct server/database
// access, not just a web request.
//
// Usage: npm run admin:promote -- someone@example.com
// The account must already exist — have them sign up at /account/signup
// first with the email+password they'll use as their admin login.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error('Usage: npm run admin:promote -- someone@example.com');
    process.exit(1);
  }

  const customer = await prisma.customer.findUnique({ where: { email } });
  if (!customer) {
    console.error(`No account found for ${email}. They need to sign up at /account/signup first.`);
    process.exit(1);
  }

  if (customer.isAdmin) {
    console.log(`${email} is already an admin.`);
    return;
  }

  await prisma.customer.update({ where: { id: customer.id }, data: { isAdmin: true } });
  console.log(`${email} is now an admin. They can sign in at /account/login and will see an "Admin" link.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
