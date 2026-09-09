#!/usr/bin/env node
// Використання: node scripts/hash-password.mjs "пароль"
// Друкує bcrypt-хеш (cost 12) для додавання в ADMIN_USERS.
import bcrypt from "bcryptjs";

const password = process.argv[2];
if (!password) {
  console.error('Використання: node scripts/hash-password.mjs "пароль"');
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);
console.log(hash);
