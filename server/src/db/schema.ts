import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  index,
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
  phone: text('phone').unique(),
  phoneVerifiedAt: timestamp('phone_verified_at', { withTimezone: true }),
  studentBonusGrantedAt: timestamp('student_bonus_granted_at', { withTimezone: true }),
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

export const courses = pgTable('courses', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  durationDays: integer('duration_days').notNull(),
  grantedLessons: integer('granted_lessons').notNull(),
  priceRub: numeric('price_rub', { precision: 12, scale: 2 }).notNull().default('0'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const courseOrders = pgTable('course_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  sourceCourseId: uuid('source_course_id').references(() => courses.id, { onDelete: 'set null' }),
  orderType: text('order_type', { enum: ['purchase', 'upgrade'] }).notNull().default('purchase'),
  status: text('status', { enum: ['pending', 'completed', 'failed', 'cancelled'] }).notNull().default('pending'),
  expectedAmountRub: numeric('expected_amount_rub', { precision: 12, scale: 2 }).notNull(),
  paidAmountRub: numeric('paid_amount_rub', { precision: 12, scale: 2 }),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const courseAccess = pgTable(
  'course_access',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
    grantedLessons: integer('granted_lessons').notNull(),
    source: text('source', { enum: ['purchase', 'upgrade', 'admin', 'bonus'] }).notNull().default('purchase'),
    status: text('status', { enum: ['active', 'revoked'] }).notNull().default('active'),
    orderId: uuid('order_id').references(() => courseOrders.id, { onDelete: 'set null' }),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('course_access_user_id_idx').on(t.userId)]
);

export const referralCodes = pgTable(
  'referral_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    code: text('code').notNull().unique(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('referral_codes_owner_user_idx').on(t.ownerUserId)]
);

export const referralAttributions = pgTable(
  'referral_attributions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    referralCodeId: uuid('referral_code_id').notNull().references(() => referralCodes.id, { onDelete: 'cascade' }),
    referrerUserId: uuid('referrer_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    refereeUserId: uuid('referee_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    status: text('status', { enum: ['pending_phone_verification', 'signup_bonus_granted', 'purchase_bonus_granted', 'completed', 'cancelled'] }).notNull().default('pending_phone_verification'),
    signupRewardGrantedAt: timestamp('signup_reward_granted_at', { withTimezone: true }),
    purchaseRewardGrantedAt: timestamp('purchase_reward_granted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('referral_attributions_referee_user_idx').on(t.refereeUserId)]
);

export const referralRewards = pgTable(
  'referral_rewards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    attributionId: uuid('attribution_id').notNull().references(() => referralAttributions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    rewardType: text('reward_type', { enum: ['signup_bonus', 'course_purchase_bonus'] }).notNull(),
    amountRub: numeric('amount_rub', { precision: 12, scale: 2 }).notNull(),
    amountTokens: integer('amount_tokens').notNull(),
    status: text('status', { enum: ['granted', 'cancelled'] }).notNull().default('granted'),
    referenceId: text('reference_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('referral_rewards_unique_idx').on(t.attributionId, t.userId, t.rewardType)]
);

export const phoneVerifications = pgTable(
  'phone_verifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    phone: text('phone').notNull(),
    purpose: text('purpose', { enum: ['referral_unlock', 'phone_change'] }).notNull().default('referral_unlock'),
    codeHash: text('code_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
    lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
    attempts: integer('attempts').notNull().default(0),
    requestCount: integer('request_count').notNull().default(1),
    requestWindowStartedAt: timestamp('request_window_started_at', { withTimezone: true }).notNull().defaultNow(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('phone_verifications_user_purpose_idx').on(t.userId, t.purpose)]
);

export const oauthIdentities = pgTable(
  'oauth_identities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider', { enum: ['vkid'] }).notNull(),
    providerUserId: text('provider_user_id').notNull(),
    providerEmail: text('provider_email'),
    providerEmailVerified: boolean('provider_email_verified').notNull().default(false),
    rawProfileJson: text('raw_profile_json'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('oauth_identities_provider_user_idx').on(t.provider, t.providerUserId),
    uniqueIndex('oauth_identities_user_provider_idx').on(t.userId, t.provider),
    index('oauth_identities_provider_email_idx').on(t.providerEmail),
  ]
);

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

export const aiAttachments = pgTable('ai_attachments', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kind: text('kind', { enum: ['image', 'document'] }).notNull().default('document'),
  originalName: text('original_name').notNull(),
  mimeType: text('mime_type').notNull(),
  fileSize: integer('file_size').notNull(),
  storagePath: text('storage_path').notNull(),
  status: text('status', { enum: ['ready', 'failed'] }).notNull().default('ready'),
  extractedText: text('extracted_text'),
  extractedPreview: text('extracted_preview'),
  pageCount: integer('page_count'),
  sheetCount: integer('sheet_count'),
  slideCount: integer('slide_count'),
  errorMessage: text('error_message'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
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
  requestType: text('request_type', { enum: ['chat', 'image', 'quiz', 'tts'] }).notNull(),
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
  paidAmount: numeric('paid_amount', { precision: 12, scale: 2 }),
  paymentType: text('payment_type', { enum: ['topup', 'course_purchase', 'course_upgrade'] }).notNull().default('topup'),
  courseOrderId: uuid('course_order_id').references(() => courseOrders.id, { onDelete: 'set null' }),
  status: text('status', { enum: ['pending', 'completed', 'failed'] }).notNull().default('pending'),
  robokassaSignature: text('robokassa_signature'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (t) => [uniqueIndex('payments_inv_id_idx').on(t.invId)]);

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
export type Course = typeof courses.$inferSelect;
export type CourseOrder = typeof courseOrders.$inferSelect;
export type CourseAccess = typeof courseAccess.$inferSelect;
export type ReferralCode = typeof referralCodes.$inferSelect;
export type ReferralAttribution = typeof referralAttributions.$inferSelect;
export type ReferralReward = typeof referralRewards.$inferSelect;
export type PhoneVerification = typeof phoneVerifications.$inferSelect;
export type OAuthIdentity = typeof oauthIdentities.$inferSelect;
export type Testimonial = typeof testimonials.$inferSelect;
export type AIProvider = typeof aiProviders.$inferSelect;
export type ProviderSecret = typeof providerSecrets.$inferSelect;
export type AIModel = typeof aiModels.$inferSelect;
export type AIAttachment = typeof aiAttachments.$inferSelect;
export type UserBalance = typeof userBalances.$inferSelect;
export type BalanceTransaction = typeof balanceTransactions.$inferSelect;
export type AIUsageLogEntry = typeof aiUsageLog.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type PlatformSetting = typeof platformSettings.$inferSelect;
