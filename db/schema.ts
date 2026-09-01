import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const dishes = sqliteTable('dishes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  shortDescription: text('short_description').notNull(),
  ingredients: text('ingredients').notNull(),
  allergens: text('allergens').notNull().default('[]'),
  serviceNote: text('service_note').notNull().default(''),
  badge: text('badge').notNull().default(''),
  color: text('color').notNull().default('sage'),
  category: text('category').notNull().default('crudo'),
  weight: integer('weight').notNull().default(0),
  components: text('components').notNull().default('{}'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
});

export const inviteCodes = sqliteTable('invite_codes', {
  code: text('code').primaryKey(),
  label: text('label').notNull(),
  role: text('role').notNull().default('employee'),
  maxUses: integer('max_uses').notNull().default(1),
  usedCount: integer('used_count').notNull().default(0),
  createdAt: text('created_at').notNull(),
});

export const staff = sqliteTable('staff', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  role: text('role').notNull().default('employee'),
  inviteCode: text('invite_code').notNull(),
  createdAt: text('created_at').notNull(),
  telegramId: text('telegram_id').unique(),
  username: text('username'),
  photoUrl: text('photo_url'),
  lastSeenAt: text('last_seen_at'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
});

export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const sessions = sqliteTable('sessions', {
  tokenHash: text('token_hash').primaryKey(),
  staffId: integer('staff_id').notNull(),
  createdAt: text('created_at').notNull(),
  expiresAt: text('expires_at').notNull(),
});

export const authAttempts = sqliteTable('auth_attempts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  telegramId: text('telegram_id').notNull(),
  success: integer('success', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
});

export const attempts = sqliteTable('attempts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  staffId: integer('staff_id').notNull(),
  score: integer('score').notNull(),
  total: integer('total').notNull(),
  createdAt: text('created_at').notNull(),
});
