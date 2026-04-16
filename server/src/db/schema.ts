import { pgTable, uuid, text, boolean, timestamp, integer, uniqueIndex, numeric } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
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
    role: text('role').notNull().default('learner'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('user_roles_user_id_role_idx').on(table.userId, table.role)]
);

export const lessonContent = pgTable('lesson_content', {
  id: uuid('id').primaryKey().defaultRandom(),
  lessonId: integer('lesson_id').notNull().unique(),
  customDescription: text('custom_description'),
  videoUrls: text('video_urls').array().default([]),
  videoTitles: text('video_titles').array().default([]),
  videoPreviewUrls: text('video_preview_urls').array().default([]),
  pdfUrls: text('pdf_urls').array().default([]),
  additionalMaterials: text('additional_materials'),
  aiPrompt: text('ai_prompt'),
  aiPromptIsOverride: boolean('ai_prompt_is_override').notNull().default(false),
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
  (table) => [uniqueIndex('student_progress_user_lesson_idx').on(table.userId, table.lessonId)]
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

export const testimonials = pgTable('testimonials', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  roleOrSubtitle: text('role_or_subtitle').notNull().default(''),
  text: text('text').notNull(),
  avatarVariant: text('avatar_variant', { enum: ['male', 'female'] }).notNull().default('male'),
  sortOrder: integer('sort_order').notNull().default(0),
  isPublished: boolean('is_published').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

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
  providerId: uuid('provider_id')
    .notNull()
    .unique()
    .references(() => aiProviders.id, { onDelete: 'cascade' }),
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
  supportsDocumentInput: boolean('supports_document_input').notNull().default(false),
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

export const platformSettings = pgTable('platform_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  description: text('description'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserRole = typeof userRoles.$inferSelect;
export type LessonContent = typeof lessonContent.$inferSelect;
export type StudentProgress = typeof studentProgress.$inferSelect;
export type PracticalMaterial = typeof practicalMaterials.$inferSelect;
export type Testimonial = typeof testimonials.$inferSelect;
export type AIProvider = typeof aiProviders.$inferSelect;
export type ProviderSecret = typeof providerSecrets.$inferSelect;
export type AIModel = typeof aiModels.$inferSelect;
export type PlatformSetting = typeof platformSettings.$inferSelect;

export * from './lms-schema.js';
