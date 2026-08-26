// One-shot admin bootstrap: creates a Customer with isAdmin: true directly,
// for when there's no existing account to promote via admin:promote yet.
// Password hashing here deliberately mirrors hashPassword() in
// lib/customer-auth.ts exactly (scrypt, random 16-byte salt, `salt:hash`
// format) rather than importing that module, since it also pulls in
// next/headers, which only works inside a Next.js request — not a
// standalone script.
//
// Credentials are read from environment variables, never hardcoded or
// committed, and are not printed back out. Usage:
//   ADMIN_EMAIL="you@example.com" ADMIN_PASSWORD="..." npm run create-admin
//
// Safe to re-run: if the account already exists, only promotes it
// (isAdmin: true) and leaves its existing password untouched.
import { scryptSync, randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('Usage: ADMIN_EMAIL="you@example.com" ADMIN_PASSWORD="..." npm run create-admin');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('ADMIN_PASSWORD must be at least 8 characters (matches the signup form\'s own rule).');
    process.exit(1);
  }

  const existing = await prisma.customer.findUnique({ where: { email } });

  if (existing) {
    if (existing.isAdmin) {
      console.log(`${email} already exists and is already an admin. No changes made.`);
    } else {
      await prisma.customer.update({ where: { id: existing.id }, data: { isAdmin: true } });
      console.log(`${email} already existed — promoted to admin. Its existing password was left unchanged.`);
    }
    return;
  }

  await prisma.customer.create({
    data: {
      name: 'Admin',
      email,
      passwordHash: hashPassword(password),
      isAdmin: true,
    },
  });
  console.log(`Created admin account for ${email}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
