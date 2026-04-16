import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  uniqueIndex,
  jsonb,
  primaryKey,
} from 'drizzle-orm/pg-core';

export const lmsOrganization = pgTable('lms_organization', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const lmsDepartment = pgTable('lms_department', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => lmsOrganization.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const lmsUnit = pgTable('lms_unit', {
  id: uuid('id').primaryKey().defaultRandom(),
  departmentId: uuid('department_id')
    .notNull()
    .references(() => lmsDepartment.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const lmsPosition = pgTable('lms_position', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const lmsEmployee = pgTable('lms_employee', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique(),
  departmentId: uuid('department_id').references(() => lmsDepartment.id, { onDelete: 'set null' }),
  unitId: uuid('unit_id').references(() => lmsUnit.id, { onDelete: 'set null' }),
  positionId: uuid('position_id').references(() => lmsPosition.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const lmsCourse = pgTable('lms_course', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description'),
  isPublished: boolean('is_published').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const lmsCourseModule = pgTable('lms_course_module', {
  id: uuid('id').primaryKey().defaultRandom(),
  courseId: uuid('course_id')
    .notNull()
    .references(() => lmsCourse.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  moduleKind: text('module_kind').notNull(),
});

export const lmsModuleItem = pgTable('lms_module_item', {
  id: uuid('id').primaryKey().defaultRandom(),
  moduleId: uuid('module_id')
    .notNull()
    .references(() => lmsCourseModule.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  itemType: text('item_type').notNull(),
  content: jsonb('content').notNull().default({}),
});

export const lmsTest = pgTable('lms_test', {
  id: uuid('id').primaryKey().defaultRandom(),
  moduleItemId: uuid('module_item_id')
    .notNull()
    .unique()
    .references(() => lmsModuleItem.id, { onDelete: 'cascade' }),
  passScorePercent: integer('pass_score_percent').notNull().default(70),
  timeLimitSec: integer('time_limit_sec'),
  maxAttempts: integer('max_attempts').notNull().default(3),
  cooldownHours: integer('cooldown_hours').notNull().default(0),
  randomizeQuestions: boolean('randomize_questions').notNull().default(false),
});

export const lmsQuestion = pgTable('lms_question', {
  id: uuid('id').primaryKey().defaultRandom(),
  testId: uuid('test_id')
    .notNull()
    .references(() => lmsTest.id, { onDelete: 'cascade' }),
  topic: text('topic'),
  questionType: text('question_type').notNull(),
  body: jsonb('body').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const lmsLearningGroup = pgTable('lms_learning_group', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  tutorUserId: uuid('tutor_user_id'),
  mentorUserId: uuid('mentor_user_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const lmsGroupMember = pgTable(
  'lms_group_member',
  {
    groupId: uuid('group_id')
      .notNull()
      .references(() => lmsLearningGroup.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.userId] })],
);

export const lmsAssignment = pgTable('lms_assignment', {
  id: uuid('id').primaryKey().defaultRandom(),
  courseId: uuid('course_id')
    .notNull()
    .references(() => lmsCourse.id, { onDelete: 'cascade' }),
  assigneeType: text('assignee_type').notNull(),
  groupId: uuid('group_id').references(() => lmsLearningGroup.id, { onDelete: 'cascade' }),
  userId: uuid('user_id'),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  deadlineDays: integer('deadline_days'),
  enforceSequence: boolean('enforce_sequence').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const lmsEnrollment = pgTable(
  'lms_enrollment',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    assignmentId: uuid('assignment_id')
      .notNull()
      .references(() => lmsAssignment.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    status: text('status').notNull().default('active'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('lms_enrollment_assignment_user_idx').on(table.assignmentId, table.userId)],
);

export const lmsItemProgress = pgTable(
  'lms_item_progress',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    enrollmentId: uuid('enrollment_id')
      .notNull()
      .references(() => lmsEnrollment.id, { onDelete: 'cascade' }),
    moduleItemId: uuid('module_item_id')
      .notNull()
      .references(() => lmsModuleItem.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('locked'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [uniqueIndex('lms_item_progress_enrollment_item_idx').on(table.enrollmentId, table.moduleItemId)],
);

export const lmsTestAttempt = pgTable('lms_test_attempt', {
  id: uuid('id').primaryKey().defaultRandom(),
  testId: uuid('test_id')
    .notNull()
    .references(() => lmsTest.id, { onDelete: 'cascade' }),
  enrollmentId: uuid('enrollment_id')
    .notNull()
    .references(() => lmsEnrollment.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  scorePercent: integer('score_percent'),
  passed: boolean('passed'),
  answers: jsonb('answers'),
});

export const lmsPracticeSubmission = pgTable('lms_practice_submission', {
  id: uuid('id').primaryKey().defaultRandom(),
  moduleItemId: uuid('module_item_id')
    .notNull()
    .references(() => lmsModuleItem.id, { onDelete: 'cascade' }),
  enrollmentId: uuid('enrollment_id')
    .notNull()
    .references(() => lmsEnrollment.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  status: text('status').notNull().default('pending'),
  fileUrls: text('file_urls').array().default([]),
  comment: text('comment'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewerUserId: uuid('reviewer_user_id'),
  mentorUserId: uuid('mentor_user_id'),
  feedback: text('feedback'),
});
