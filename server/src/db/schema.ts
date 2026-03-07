import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  uniqueIndex,
  numeric,
  serial,
} from 'drizzle-orm/pg-core';

export const invitationCodes = pgTable('invitation_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  comment: text('comment').notNull().default(''),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  invitationCodeId: uuid('invitation_code_id').references(() => invitationCodes.id),
  isBlocked: boolean('is_blocked').notNull().default(false),
  blockedAt: timestamp('blocked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const userRoles = pgTable(
  'user_roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['admin', 'student', 'ai_user'] }).notNull().default('student'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('user_roles_user_id_role_idx').on(t.userId, t.role)]
);

export const lessonContent = pgTable('lesson_content', {
  id: uuid('id').primaryKey().defaultRandom(),
  lessonId: integer('lesson_id').notNull().unique(),
  customDescription: text('custom_description'),
  videoUrls: text('video_urls').array().default([]),
  videoPreviewUrls: text('video_preview_urls').array().default([]),
  pdfUrls: text('pdf_urls').array().default([]),
  additionalMaterials: text('additional_materials'),
  aiPrompt: text('ai_prompt'),
  isPublished: boolean('is_published').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const studentProgress = pgTable(
  'student_progress',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    lessonId: integer('lesson_id').notNull(),
    completed: boolean('completed').default(false),
    quizCompleted: boolean('quiz_completed').default(false),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('student_progress_user_lesson_idx').on(t.userId, t.lessonId)]
);

export const practicalMaterials = pgTable('practical_materials', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description'),
  videoUrl: text('video_url').notNull(),
  previewUrl: text('preview_url'),
  sortOrder: integer('sort_order').notNull().default(0),
  isPublished: boolean('is_published').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const waitlist = pgTable('waitlist', {
  id: uuid('id').primaryKey().defaultRandom(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  contact: text('contact').notNull(),
  contactType: text('contact_type').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Billing & AI models ──

export const aiProviders = pgTable('ai_providers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  displayName: text('display_name').notNull(),
  apiKeyEnv: text('api_key_env'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const providerSecrets = pgTable('provider_secrets', {
  id: uuid('id').primaryKey().defaultRandom(),
  providerId: uuid('provider_id').notNull().unique().references(() => aiProviders.id, { onDelete: 'cascade' }),
  encryptedValue: text('encrypted_value').notNull(),
  keyVersion: integer('key_version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const aiModels = pgTable('ai_models', {
  id: uuid('id').primaryKey().defaultRandom(),
  providerId: uuid('provider_id').notNull().references(() => aiProviders.id, { onDelete: 'cascade' }),
  modelKey: text('model_key').notNull(),
  displayName: text('display_name').notNull(),
  modelType: text('model_type', { enum: ['text', 'image'] }).notNull(),
  supportsStreaming: boolean('supports_streaming').notNull().default(false),
  supportsImageInput: boolean('supports_image_input').notNull().default(false),
  supportsImageOutput: boolean('supports_image_output').notNull().default(false),
  supportsSystemPrompt: boolean('supports_system_prompt').notNull().default(true),
  inputPricePer1k: numeric('input_price_per_1k', { precision: 10, scale: 6 }).default('0'),
  outputPricePer1k: numeric('output_price_per_1k', { precision: 10, scale: 6 }).default('0'),
  fixedPrice: numeric('fixed_price', { precision: 10, scale: 4 }).default('0'),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const userBalances = pgTable('user_balances', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  balance: numeric('balance', { precision: 12, scale: 2 }).notNull().default('0'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const balanceTransactions = pgTable('balance_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  type: text('type', { enum: ['topup', 'ai_usage', 'bonus', 'refund'] }).notNull(),
  description: text('description'),
  referenceId: text('reference_id'),
  balanceAfter: numeric('balance_after', { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const aiUsageLog = pgTable('ai_usage_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  modelId: uuid('model_id').references(() => aiModels.id),
  requestType: text('request_type', { enum: ['chat', 'image', 'quiz'] }).notNull(),
  inputTokens: integer('input_tokens').default(0),
  outputTokens: integer('output_tokens').default(0),
  baseCost: numeric('base_cost', { precision: 10, scale: 6 }).default('0'),
  finalCost: numeric('final_cost', { precision: 10, scale: 6 }).default('0'),
  isFree: boolean('is_free').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  invId: serial('inv_id').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  status: text('status', { enum: ['pending', 'completed', 'failed'] }).notNull().default('pending'),
  robokassaSignature: text('robokassa_signature'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

export const platformSettings = pgTable('platform_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  description: text('description'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Types ──

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserRole = typeof userRoles.$inferSelect;
export type InvitationCode = typeof invitationCodes.$inferSelect;
export type LessonContent = typeof lessonContent.$inferSelect;
export type StudentProgress = typeof studentProgress.$inferSelect;
export type PracticalMaterial = typeof practicalMaterials.$inferSelect;
export type WaitlistEntry = typeof waitlist.$inferSelect;
export type AIProvider = typeof aiProviders.$inferSelect;
export type ProviderSecret = typeof providerSecrets.$inferSelect;
export type AIModel = typeof aiModels.$inferSelect;
export type UserBalance = typeof userBalances.$inferSelect;
export type BalanceTransaction = typeof balanceTransactions.$inferSelect;
export type AIUsageLogEntry = typeof aiUsageLog.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type PlatformSetting = typeof platformSettings.$inferSelect;
