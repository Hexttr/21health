import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { and, asc, count, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  lmsAssignment,
  lmsCourse,
  lmsCourseModule,
  lmsDepartment,
  lmsEmployee,
  lmsEnrollment,
  lmsGroupMember,
  lmsItemProgress,
  lmsLearningGroup,
  lmsModuleItem,
  lmsOrganization,
  lmsPosition,
  lmsPracticeSubmission,
  lmsQuestion,
  lmsTest,
  lmsTestAttempt,
  lmsUnit,
  users,
} from '../db/schema.js';
import { getAuthFromRequest } from '../lib/auth.js';
import { fetchUserRoles, isAdmin, isAdminOrTutor, isStaffAnalytics } from '../lib/lms-guards.js';
import {
  ensureProgressRows,
  getCourseItemOrder,
  markItemCompleted,
  scoreTestAnswers,
} from '../lib/lms-logic.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdir, writeFile } from 'fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOADS_LMS = join(__dirname, '..', 'uploads', 'lms');

function stripQuestionForClient(q: { id: string; questionType: string; body: unknown }) {
  const body = q.body as Record<string, unknown>;
  if (q.questionType === 'single') {
    const { correctIndex: _c, ...rest } = body;
    return { ...q, body: rest };
  }
  if (q.questionType === 'multi') {
    const { correctIndices: _c, ...rest } = body;
    return { ...q, body: rest };
  }
  return q;
}

async function requireUser(req: FastifyRequest, reply: FastifyReply) {
  const p = getAuthFromRequest(req);
  if (!p) {
    reply.status(401).send({ error: 'Требуется авторизация' });
    return null;
  }
  return p;
}

export async function lmsRoutes(app: FastifyInstance) {
  // --- Organization ---
  app.get('/lms/organization', async (req, reply) => {
    const p = await requireUser(req, reply);
    if (!p) return;
    const [org] = await db.select().from(lmsOrganization).limit(1);
    return reply.send({ organization: org || null });
  });

  app.patch('/lms/organization', async (req, reply) => {
    const p = await requireUser(req, reply);
    if (!p) return;
    const roles = await fetchUserRoles(p.userId);
    if (!isAdmin(roles)) return reply.status(403).send({ error: 'Недостаточно прав' });
    const body = (req.body as { name?: string }) || {};
    const [org] = await db.select().from(lmsOrganization).limit(1);
    if (!org) {
      const [created] = await db.insert(lmsOrganization).values({ name: body.name || 'Организация' }).returning();
      return reply.send({ organization: created });
    }
    const [updated] = await db
      .update(lmsOrganization)
      .set({ name: body.name ?? org.name })
      .where(eq(lmsOrganization.id, org.id))
      .returning();
    return reply.send({ organization: updated });
  });

  // --- Departments / units / positions ---
  app.get('/lms/departments', async (req, reply) => {
    const p = await requireUser(req, reply);
    if (!p) return;
    const roles = await fetchUserRoles(p.userId);
    if (!isAdmin(roles)) return reply.status(403).send({ error: 'Недостаточно прав' });
    const [org] = await db.select().from(lmsOrganization).limit(1);
    if (!org) return reply.send({ departments: [] });
    const rows = await db
      .select()
      .from(lmsDepartment)
      .where(eq(lmsDepartment.organizationId, org.id))
      .orderBy(asc(lmsDepartment.sortOrder));
    return reply.send({ departments: rows });
  });

  app.post('/lms/departments', async (req, reply) => {
    const p = await requireUser(req, reply);
    if (!p) return;
    const roles = await fetchUserRoles(p.userId);
    if (!isAdmin(roles)) return reply.status(403).send({ error: 'Недостаточно прав' });
    const [org] = await db.select().from(lmsOrganization).limit(1);
    if (!org) return reply.status(400).send({ error: 'Сначала создайте организацию' });
    const { name, sortOrder } = (req.body as { name?: string; sortOrder?: number }) || {};
    if (!name?.trim()) return reply.status(400).send({ error: 'name обязателен' });
    const [row] = await db
      .insert(lmsDepartment)
      .values({ organizationId: org.id, name: name.trim(), sortOrder: sortOrder ?? 0 })
      .returning();
    return reply.send({ department: row });
  });

  app.get('/lms/units', async (req, reply) => {
    const p = await requireUser(req, reply);
    if (!p) return;
    const roles = await fetchUserRoles(p.userId);
    if (!isAdmin(roles)) return reply.status(403).send({ error: 'Недостаточно прав' });
    const departmentId = (req.query as { departmentId?: string }).departmentId;
    if (!departmentId) return reply.status(400).send({ error: 'departmentId обязателен' });
    const rows = await db
      .select()
      .from(lmsUnit)
      .where(eq(lmsUnit.departmentId, departmentId))
      .orderBy(asc(lmsUnit.sortOrder));
    return reply.send({ units: rows });
  });

  app.post('/lms/units', async (req, reply) => {
    const p = await requireUser(req, reply);
    if (!p) return;
    const roles = await fetchUserRoles(p.userId);
    if (!isAdmin(roles)) return reply.status(403).send({ error: 'Недостаточно прав' });
    const { departmentId, name, sortOrder } = (req.body as {
      departmentId?: string;
      name?: string;
      sortOrder?: number;
    }) || {};
    if (!departmentId || !name?.trim()) return reply.status(400).send({ error: 'departmentId и name обязательны' });
    const [row] = await db
      .insert(lmsUnit)
      .values({ departmentId, name: name.trim(), sortOrder: sortOrder ?? 0 })
      .returning();
    return reply.send({ unit: row });
  });

  app.get('/lms/positions', async (req, reply) => {
    const p = await requireUser(req, reply);
    if (!p) return;
    const roles = await fetchUserRoles(p.userId);
    if (!isAdmin(roles)) return reply.status(403).send({ error: 'Недостаточно прав' });
    const rows = await db.select().from(lmsPosition).orderBy(asc(lmsPosition.sortOrder));
    return reply.send({ positions: rows });
  });

  app.post('/lms/positions', async (req, reply) => {
    const p = await requireUser(req, reply);
    if (!p) return;
    const roles = await fetchUserRoles(p.userId);
    if (!isAdmin(roles)) return reply.status(403).send({ error: 'Недостаточно прав' });
    const { name, sortOrder } = (req.body as { name?: string; sortOrder?: number }) || {};
    if (!name?.trim()) return reply.status(400).send({ error: 'name обязателен' });
    const [row] = await db
      .insert(lmsPosition)
      .values({ name: name.trim(), sortOrder: sortOrder ?? 0 })
      .returning();
    return reply.send({ position: row });
  });

  // --- Employees ---
  app.get('/lms/employees', async (req, reply) => {
    const p = await requireUser(req, reply);
    if (!p) return;
    const roles = await fetchUserRoles(p.userId);
    if (!isAdmin(roles)) return reply.status(403).send({ error: 'Недостаточно прав' });
    const rows = await db.select().from(lmsEmployee);
    const userIds = rows.map((r) => r.userId);
    const uRows = userIds.length ? await db.select().from(users).where(inArray(users.id, userIds)) : [];
    const map = new Map(uRows.map((u) => [u.id, u]));
    return reply.send({
      employees: rows.map((e) => ({
        ...e,
        user: map.get(e.userId) || null,
      })),
    });
  });

  app.post('/lms/employees', async (req, reply) => {
    const p = await requireUser(req, reply);
    if (!p) return;
    const roles = await fetchUserRoles(p.userId);
    if (!isAdmin(roles)) return reply.status(403).send({ error: 'Недостаточно прав' });
    const b = (req.body as {
      userId?: string;
      departmentId?: string | null;
      unitId?: string | null;
      positionId?: string | null;
    }) || {};
    if (!b.userId) return reply.status(400).send({ error: 'userId обязателен' });
    const [row] = await db
      .insert(lmsEmployee)
      .values({
        userId: b.userId,
        departmentId: b.departmentId || null,
        unitId: b.unitId || null,
        positionId: b.positionId || null,
      })
      .onConflictDoUpdate({
        target: lmsEmployee.userId,
        set: {
          departmentId: b.departmentId || null,
          unitId: b.unitId || null,
          positionId: b.positionId || null,
          updatedAt: new Date(),
        },
      })
      .returning();
    return reply.send({ employee: row });
  });

  // --- Courses (admin / tutor) ---
  app.get('/lms/courses', async (req, reply) => {
    const p = await requireUser(req, reply);
    if (!p) return;
    const roles = await fetchUserRoles(p.userId);
    if (!isAdminOrTutor(roles)) return reply.status(403).send({ error: 'Недостаточно прав' });
    const published = (req.query as { published?: string }).published;
    const rows =
      published === 'true'
        ? await db.select().from(lmsCourse).where(eq(lmsCourse.isPublished, true)).orderBy(desc(lmsCourse.updatedAt))
        : await db.select().from(lmsCourse).orderBy(desc(lmsCourse.updatedAt));
    return reply.send({ courses: rows });
  });

  app.post('/lms/courses', async (req, reply) => {
    const p = await requireUser(req, reply);
    if (!p) return;
    const roles = await fetchUserRoles(p.userId);
    if (!isAdminOrTutor(roles)) return reply.status(403).send({ error: 'Недостаточно прав' });
    const { title, description, isPublished } = (req.body as {
      title?: string;
      description?: string;
      isPublished?: boolean;
    }) || {};
    if (!title?.trim()) return reply.status(400).send({ error: 'title обязателен' });
    const [row] = await db
      .insert(lmsCourse)
      .values({
        title: title.trim(),
        description: description || null,
        isPublished: isPublished ?? false,
      })
      .returning();
    return reply.send({ course: row });
  });

  app.get('/lms/courses/:courseId', async (req, reply) => {
    const p = await requireUser(req, reply);
    if (!p) return;
    const roles = await fetchUserRoles(p.userId);
    if (!isAdminOrTutor(roles)) return reply.status(403).send({ error: 'Недостаточно прав' });
    const { courseId } = req.params as { courseId: string };
    const [course] = await db.select().from(lmsCourse).where(eq(lmsCourse.id, courseId));
    if (!course) return reply.status(404).send({ error: 'Курс не найден' });
    const modules = await db
      .select()
      .from(lmsCourseModule)
      .where(eq(lmsCourseModule.courseId, courseId))
      .orderBy(asc(lmsCourseModule.sortOrder));
    const outMods = [];
    for (const mod of modules) {
      const items = await db
        .select()
        .from(lmsModuleItem)
        .where(eq(lmsModuleItem.moduleId, mod.id))
        .orderBy(asc(lmsModuleItem.sortOrder));
      const itemsWithTests = [];
      for (const it of items) {
        if (it.itemType === 'test') {
          const [tst] = await db.select().from(lmsTest).where(eq(lmsTest.moduleItemId, it.id));
          const qs = tst
            ? await db.select().from(lmsQuestion).where(eq(lmsQuestion.testId, tst.id)).orderBy(asc(lmsQuestion.sortOrder))
            : [];
          itemsWithTests.push({ ...it, test: tst, questions: qs });
        } else {
          itemsWithTests.push({ ...it, test: null, questions: [] });
        }
      }
      outMods.push({ ...mod, items: itemsWithTests });
    }
    return reply.send({ course, modules: outMods });
  });

  app.post('/lms/courses/:courseId/modules', async (req, reply) => {
    const p = await requireUser(req, reply);
    if (!p) return;
    const roles = await fetchUserRoles(p.userId);
    if (!isAdminOrTutor(roles)) return reply.status(403).send({ error: 'Недостаточно прав' });
    const { courseId } = req.params as { courseId: string };
    const { title, sortOrder, moduleKind } = (req.body as {
      title?: string;
      sortOrder?: number;
      moduleKind?: string;
    }) || {};
    if (!title?.trim() || !moduleKind) return reply.status(400).send({ error: 'title и moduleKind обязательны' });
    const [row] = await db
      .insert(lmsCourseModule)
      .values({
        courseId,
        title: title.trim(),
        sortOrder: sortOrder ?? 0,
        moduleKind,
      })
      .returning();
    return reply.send({ module: row });
  });

  app.post('/lms/modules/:moduleId/items', async (req, reply) => {
    const p = await requireUser(req, reply);
    if (!p) return;
    const roles = await fetchUserRoles(p.userId);
    if (!isAdminOrTutor(roles)) return reply.status(403).send({ error: 'Недостаточно прав' });
    const { moduleId } = req.params as { moduleId: string };
    const { title, sortOrder, itemType, content } = (req.body as {
      title?: string;
      sortOrder?: number;
      itemType?: string;
      content?: Record<string, unknown>;
    }) || {};
    if (!title?.trim() || !itemType) return reply.status(400).send({ error: 'title и itemType обязательны' });
    const [item] = await db
      .insert(lmsModuleItem)
      .values({
        moduleId,
        title: title.trim(),
        sortOrder: sortOrder ?? 0,
        itemType,
        content: content ?? {},
      })
      .returning();

    if (itemType === 'test') {
      await db.insert(lmsTest).values({
        moduleItemId: item.id,
        passScorePercent: 70,
        maxAttempts: 3,
        cooldownHours: 0,
        randomizeQuestions: false,
      });
    }

    return reply.send({ item });
  });

  app.post('/lms/tests/:testId/questions', async (req, reply) => {
    const p = await requireUser(req, reply);
    if (!p) return;
    const roles = await fetchUserRoles(p.userId);
    if (!isAdminOrTutor(roles)) return reply.status(403).send({ error: 'Недостаточно прав' });
    const { testId } = req.params as { testId: string };
    const { topic, questionType, body, sortOrder } = (req.body as {
      topic?: string;
      questionType?: string;
      body?: Record<string, unknown>;
      sortOrder?: number;
    }) || {};
    if (!questionType || !body) return reply.status(400).send({ error: 'questionType и body обязательны' });
    const [q] = await db
      .insert(lmsQuestion)
      .values({
        testId,
        topic: topic || null,
        questionType,
        body,
        sortOrder: sortOrder ?? 0,
      })
      .returning();
    return reply.send({ question: q });
  });

  // --- Groups ---
  app.get('/lms/groups', async (req, reply) => {
    const p = await requireUser(req, reply);
    if (!p) return;
    const roles = await fetchUserRoles(p.userId);
    if (!isAdminOrTutor(roles)) return reply.status(403).send({ error: 'Недостаточно прав' });
    const rows = await db.select().from(lmsLearningGroup).orderBy(desc(lmsLearningGroup.createdAt));
    return reply.send({ groups: rows });
  });

  app.post('/lms/groups', async (req, reply) => {
    const p = await requireUser(req, reply);
    if (!p) return;
    const roles = await fetchUserRoles(p.userId);
    if (!isAdminOrTutor(roles)) return reply.status(403).send({ error: 'Недостаточно прав' });
    const { name, tutorUserId, mentorUserId } = (req.body as {
      name?: string;
      tutorUserId?: string | null;
      mentorUserId?: string | null;
    }) || {};
    if (!name?.trim()) return reply.status(400).send({ error: 'name обязателен' });
    const [g] = await db
      .insert(lmsLearningGroup)
      .values({
        name: name.trim(),
        tutorUserId: tutorUserId || null,
        mentorUserId: mentorUserId || null,
      })
      .returning();
    return reply.send({ group: g });
  });

  app.post('/lms/groups/:groupId/members', async (req, reply) => {
    const p = await requireUser(req, reply);
    if (!p) return;
    const roles = await fetchUserRoles(p.userId);
    if (!isAdminOrTutor(roles)) return reply.status(403).send({ error: 'Недостаточно прав' });
    const { groupId } = req.params as { groupId: string };
    const { userId } = (req.body as { userId?: string }) || {};
    if (!userId) return reply.status(400).send({ error: 'userId обязателен' });
    await db.insert(lmsGroupMember).values({ groupId, userId }).onConflictDoNothing();
    return reply.send({ ok: true });
  });

  // --- Assignments ---
  app.post('/lms/assignments', async (req, reply) => {
    const p = await requireUser(req, reply);
    if (!p) return;
    const roles = await fetchUserRoles(p.userId);
    if (!isAdminOrTutor(roles)) return reply.status(403).send({ error: 'Недостаточно прав' });
    const b = (req.body as {
      courseId?: string;
      assigneeType?: string;
      groupId?: string | null;
      userId?: string | null;
      startsAt?: string;
      endsAt?: string | null;
      deadlineDays?: number | null;
      enforceSequence?: boolean;
    }) || {};
    if (!b.courseId || !b.assigneeType || !b.startsAt) {
      return reply.status(400).send({ error: 'courseId, assigneeType, startsAt обязательны' });
    }
    if (b.assigneeType === 'group' && !b.groupId) return reply.status(400).send({ error: 'groupId нужен для group' });
    if (b.assigneeType === 'user' && !b.userId) return reply.status(400).send({ error: 'userId нужен для user' });

    const [asg] = await db
      .insert(lmsAssignment)
      .values({
        courseId: b.courseId,
        assigneeType: b.assigneeType,
        groupId: b.groupId || null,
        userId: b.userId || null,
        startsAt: new Date(b.startsAt),
        endsAt: b.endsAt ? new Date(b.endsAt) : null,
        deadlineDays: b.deadlineDays ?? null,
        enforceSequence: b.enforceSequence ?? true,
      })
      .returning();

    const userIds: string[] = [];
    if (asg.assigneeType === 'user' && asg.userId) userIds.push(asg.userId);
    if (asg.assigneeType === 'group' && asg.groupId) {
      const mems = await db.select().from(lmsGroupMember).where(eq(lmsGroupMember.groupId, asg.groupId));
      userIds.push(...mems.map((m) => m.userId));
    }

    for (const uid of [...new Set(userIds)]) {
      await db
        .insert(lmsEnrollment)
        .values({
          assignmentId: asg.id,
          userId: uid,
          status: 'active',
          startedAt: new Date(),
        })
        .onConflictDoNothing({ target: [lmsEnrollment.assignmentId, lmsEnrollment.userId] });
      const [en] = await db
        .select()
        .from(lmsEnrollment)
        .where(and(eq(lmsEnrollment.assignmentId, asg.id), eq(lmsEnrollment.userId, uid)));
      if (en) {
        await ensureProgressRows(en.id, asg.courseId, asg.enforceSequence);
      }
    }

    return reply.send({ assignment: asg });
  });

  app.get('/lms/assignments', async (req, reply) => {
    const p = await requireUser(req, reply);
    if (!p) return;
    const roles = await fetchUserRoles(p.userId);
    if (!isAdminOrTutor(roles)) return reply.status(403).send({ error: 'Недостаточно прав' });
    const rows = await db.select().from(lmsAssignment).orderBy(desc(lmsAssignment.createdAt));
    return reply.send({ assignments: rows });
  });

  // --- Learner: my enrollments ---
  app.get('/lms/my/enrollments', async (req, reply) => {
    const p = await requireUser(req, reply);
    if (!p) return;
    const rows = await db.select().from(lmsEnrollment).where(eq(lmsEnrollment.userId, p.userId));
    const out = [];
    for (const e of rows) {
      const [asg] = await db.select().from(lmsAssignment).where(eq(lmsAssignment.id, e.assignmentId));
      const [course] = asg ? await db.select().from(lmsCourse).where(eq(lmsCourse.id, asg.courseId)) : [null];
      out.push({ enrollment: e, assignment: asg, course });
    }
    return reply.send({ enrollments: out });
  });

  app.get('/lms/enrollments/:enrollmentId', async (req, reply) => {
    const p = await requireUser(req, reply);
    if (!p) return;
    const { enrollmentId } = req.params as { enrollmentId: string };
    const [en] = await db.select().from(lmsEnrollment).where(eq(lmsEnrollment.id, enrollmentId));
    if (!en) return reply.status(404).send({ error: 'Не найдено' });
    if (en.userId !== p.userId) {
      const roles = await fetchUserRoles(p.userId);
      if (!isAdminOrTutor(roles)) return reply.status(403).send({ error: 'Нет доступа' });
    }
    const [asg] = await db.select().from(lmsAssignment).where(eq(lmsAssignment.id, en.assignmentId));
    if (!asg) return reply.status(404).send({ error: 'Назначение не найдено' });
    await ensureProgressRows(en.id, asg.courseId, asg.enforceSequence);
    const [course] = await db.select().from(lmsCourse).where(eq(lmsCourse.id, asg.courseId));
    const modules = await db
      .select()
      .from(lmsCourseModule)
      .where(eq(lmsCourseModule.courseId, asg.courseId))
      .orderBy(asc(lmsCourseModule.sortOrder));
    const progress = await db.select().from(lmsItemProgress).where(eq(lmsItemProgress.enrollmentId, en.id));
    const progMap = new Map(progress.map((x) => [x.moduleItemId, x]));

    const tree = [];
    const testRowsByItem = new Map<string, typeof lmsTest.$inferSelect>();
    for (const mod of modules) {
      const items = await db
        .select()
        .from(lmsModuleItem)
        .where(eq(lmsModuleItem.moduleId, mod.id))
        .orderBy(asc(lmsModuleItem.sortOrder));
      const testIds = items.filter((i) => i.itemType === 'test').map((i) => i.id);
      if (testIds.length) {
        const trows = await db.select().from(lmsTest).where(inArray(lmsTest.moduleItemId, testIds));
        for (const t of trows) testRowsByItem.set(t.moduleItemId, t);
      }
      tree.push({
        module: mod,
        items: items.map((it) => ({
          item: it,
          progress: progMap.get(it.id) || null,
          test: it.itemType === 'test' ? testRowsByItem.get(it.id) ?? null : null,
        })),
      });
    }

    return reply.send({ enrollment: en, assignment: asg, course, tree });
  });

  app.post('/lms/enrollments/:enrollmentId/items/:itemId/complete-theory', async (req, reply) => {
    const p = await requireUser(req, reply);
    if (!p) return;
    const { enrollmentId, itemId } = req.params as { enrollmentId: string; itemId: string };
    const [en] = await db.select().from(lmsEnrollment).where(eq(lmsEnrollment.id, enrollmentId));
    if (!en || en.userId !== p.userId) return reply.status(403).send({ error: 'Нет доступа' });
    const [asg] = await db.select().from(lmsAssignment).where(eq(lmsAssignment.id, en.assignmentId));
    if (!asg) return reply.status(404).send({ error: 'Назначение не найдено' });
    const [it] = await db.select().from(lmsModuleItem).where(eq(lmsModuleItem.id, itemId));
    if (!it || it.itemType !== 'theory') return reply.status(400).send({ error: 'Неверный элемент' });
    await markItemCompleted(en.id, itemId, asg.courseId, asg.enforceSequence);
    return reply.send({ ok: true });
  });

  app.post('/lms/enrollments/:enrollmentId/tests/:testId/start', async (req, reply) => {
    const p = await requireUser(req, reply);
    if (!p) return;
    const { enrollmentId, testId } = req.params as { enrollmentId: string; testId: string };
    const [en] = await db.select().from(lmsEnrollment).where(eq(lmsEnrollment.id, enrollmentId));
    if (!en || en.userId !== p.userId) return reply.status(403).send({ error: 'Нет доступа' });
    const [tst] = await db.select().from(lmsTest).where(eq(lmsTest.id, testId));
    if (!tst) return reply.status(404).send({ error: 'Тест не найден' });
    const qs = await db.select().from(lmsQuestion).where(eq(lmsQuestion.testId, testId)).orderBy(asc(lmsQuestion.sortOrder));
    const clientQs = qs.map(stripQuestionForClient);

    const attempts = await db
      .select()
      .from(lmsTestAttempt)
      .where(
        and(
          eq(lmsTestAttempt.testId, testId),
          eq(lmsTestAttempt.enrollmentId, enrollmentId),
          eq(lmsTestAttempt.userId, p.userId),
        ),
      );
    const open = attempts.find((a) => !a.submittedAt);
    if (open) {
      return reply.send({ attempt: open, questions: clientQs, resumed: true });
    }
    const submitted = attempts.filter((a) => a.submittedAt);
    if (submitted.length >= tst.maxAttempts) {
      return reply.status(400).send({ error: 'Исчерпан лимит попыток' });
    }
    if (tst.cooldownHours > 0 && submitted.length > 0) {
      let last = submitted[0];
      for (const a of submitted) {
        if (new Date(a.submittedAt!).getTime() > new Date(last.submittedAt!).getTime()) last = a;
      }
      const hours = (Date.now() - new Date(last.submittedAt!).getTime()) / 3600000;
      if (hours < tst.cooldownHours) {
        const waitH = tst.cooldownHours - hours;
        return reply.status(429).send({ error: `Повторная попытка через ${waitH < 1 ? `${Math.ceil(waitH * 60)} мин` : `${waitH.toFixed(1)} ч`}` });
      }
    }

    const [attempt] = await db
      .insert(lmsTestAttempt)
      .values({
        testId,
        enrollmentId,
        userId: p.userId,
        startedAt: new Date(),
      })
      .returning();
    return reply.send({ attempt, questions: clientQs, resumed: false });
  });

  app.post('/lms/enrollments/:enrollmentId/tests/:testId/submit', async (req, reply) => {
    const p = await requireUser(req, reply);
    if (!p) return;
    const { enrollmentId, testId } = req.params as { enrollmentId: string; testId: string };
    const { attemptId, answers } = (req.body as { attemptId?: string; answers?: Record<string, unknown> }) || {};
    if (!attemptId || !answers) return reply.status(400).send({ error: 'attemptId и answers обязательны' });
    const [en] = await db.select().from(lmsEnrollment).where(eq(lmsEnrollment.id, enrollmentId));
    if (!en || en.userId !== p.userId) return reply.status(403).send({ error: 'Нет доступа' });
    const [tst] = await db.select().from(lmsTest).where(eq(lmsTest.id, testId));
    if (!tst) return reply.status(404).send({ error: 'Тест не найден' });
    const [attemptRow] = await db
      .select()
      .from(lmsTestAttempt)
      .where(and(eq(lmsTestAttempt.id, attemptId), eq(lmsTestAttempt.userId, p.userId)));
    if (!attemptRow || attemptRow.submittedAt) {
      return reply.status(400).send({ error: 'Попытка уже отправлена или не найдена' });
    }
    const qs = await db.select().from(lmsQuestion).where(eq(lmsQuestion.testId, testId));
    const { scorePercent, passed } = scoreTestAnswers(qs, answers, tst.passScorePercent);
    const [asg] = await db.select().from(lmsAssignment).where(eq(lmsAssignment.id, en.assignmentId));
    if (!asg) return reply.status(404).send({ error: 'Назначение не найдено' });

    await db
      .update(lmsTestAttempt)
      .set({
        submittedAt: new Date(),
        scorePercent,
        passed,
        answers: answers as object,
      })
      .where(and(eq(lmsTestAttempt.id, attemptId), eq(lmsTestAttempt.userId, p.userId)));

    if (passed) {
      const [item] = await db.select().from(lmsModuleItem).where(eq(lmsModuleItem.id, tst.moduleItemId));
      if (item) {
        await markItemCompleted(en.id, item.id, asg.courseId, asg.enforceSequence);
      }
    }

    return reply.send({ scorePercent, passed });
  });

  app.post('/lms/enrollments/:enrollmentId/practice', async (req, reply) => {
    const p = await requireUser(req, reply);
    if (!p) return;
    const { enrollmentId } = req.params as { enrollmentId: string };
    const { moduleItemId, fileUrls, comment } = (req.body as {
      moduleItemId?: string;
      fileUrls?: string[];
      comment?: string;
    }) || {};
    if (!moduleItemId) return reply.status(400).send({ error: 'moduleItemId обязателен' });
    const [en] = await db.select().from(lmsEnrollment).where(eq(lmsEnrollment.id, enrollmentId));
    if (!en || en.userId !== p.userId) return reply.status(403).send({ error: 'Нет доступа' });
    const [it] = await db.select().from(lmsModuleItem).where(eq(lmsModuleItem.id, moduleItemId));
    if (!it || it.itemType !== 'practice') return reply.status(400).send({ error: 'Неверный элемент' });
    const [sub] = await db
      .insert(lmsPracticeSubmission)
      .values({
        moduleItemId,
        enrollmentId,
        userId: p.userId,
        status: 'pending',
        fileUrls: fileUrls || [],
        comment: comment || null,
      })
      .returning();
    return reply.send({ submission: sub });
  });

  app.patch('/lms/practice-submissions/:submissionId', async (req, reply) => {
    const p = await requireUser(req, reply);
    if (!p) return;
    const roles = await fetchUserRoles(p.userId);
    if (!isAdminOrTutor(roles)) return reply.status(403).send({ error: 'Недостаточно прав' });
    const { submissionId } = req.params as { submissionId: string };
    const { status, feedback } = (req.body as { status?: string; feedback?: string }) || {};
    if (!status) return reply.status(400).send({ error: 'status обязателен' });
    const [sub] = await db
      .update(lmsPracticeSubmission)
      .set({
        status,
        feedback: feedback || null,
        reviewedAt: new Date(),
        reviewerUserId: p.userId,
      })
      .where(eq(lmsPracticeSubmission.id, submissionId))
      .returning();
    if (!sub) return reply.status(404).send({ error: 'Не найдено' });
    if (status === 'approved') {
      const [en] = await db.select().from(lmsEnrollment).where(eq(lmsEnrollment.id, sub.enrollmentId));
      if (en) {
        const [asg] = await db.select().from(lmsAssignment).where(eq(lmsAssignment.id, en.assignmentId));
        if (asg) {
          await markItemCompleted(en.id, sub.moduleItemId, asg.courseId, asg.enforceSequence);
        }
      }
    }
    return reply.send({ submission: sub });
  });

  app.get('/lms/practice-submissions', async (req, reply) => {
    const p = await requireUser(req, reply);
    if (!p) return;
    const roles = await fetchUserRoles(p.userId);
    if (!isAdminOrTutor(roles)) return reply.status(403).send({ error: 'Недостаточно прав' });
    const rows = await db
      .select()
      .from(lmsPracticeSubmission)
      .orderBy(desc(lmsPracticeSubmission.submittedAt))
      .limit(200);
    const userIds = [...new Set(rows.map((r) => r.userId))];
    const itemIds = [...new Set(rows.map((r) => r.moduleItemId))];
    const uRows = userIds.length ? await db.select().from(users).where(inArray(users.id, userIds)) : [];
    const iRows = itemIds.length ? await db.select().from(lmsModuleItem).where(inArray(lmsModuleItem.id, itemIds)) : [];
    const um = new Map(uRows.map((u) => [u.id, u]));
    const im = new Map(iRows.map((i) => [i.id, i]));
    return reply.send({
      submissions: rows.map((s) => ({
        ...s,
        user: um.get(s.userId) || null,
        moduleItem: im.get(s.moduleItemId) || null,
      })),
    });
  });

  app.get('/lms/users-for-assignment', async (req, reply) => {
    const p = await requireUser(req, reply);
    if (!p) return;
    const roles = await fetchUserRoles(p.userId);
    if (!isAdminOrTutor(roles)) return reply.status(403).send({ error: 'Недостаточно прав' });
    const rows = await db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .orderBy(asc(users.email));
    return reply.send({ users: rows });
  });

  // --- Analytics ---
  app.get('/lms/analytics/summary', async (req, reply) => {
    const p = await requireUser(req, reply);
    if (!p) return;
    const roles = await fetchUserRoles(p.userId);
    if (!isStaffAnalytics(roles)) return reply.status(403).send({ error: 'Недостаточно прав' });

    const [enrollmentCount] = await db.select({ n: count() }).from(lmsEnrollment);
    const [courseCount] = await db.select({ n: count() }).from(lmsCourse);
    const [pendingPractice] = await db
      .select({ n: count() })
      .from(lmsPracticeSubmission)
      .where(eq(lmsPracticeSubmission.status, 'pending'));

    return reply.send({
      enrollmentsTotal: enrollmentCount?.n ?? 0,
      coursesTotal: courseCount?.n ?? 0,
      practicePending: pendingPractice?.n ?? 0,
    });
  });

  // --- File upload for practice ---
  app.post('/lms/upload', async (req, reply) => {
    const p = await requireUser(req, reply);
    if (!p) return;
    const data = await req.file();
    if (!data) return reply.status(400).send({ error: 'Файл обязателен' });
    await mkdir(UPLOADS_LMS, { recursive: true });
    const buf = await data.toBuffer();
    const safe = (data.filename || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
    const name = `${Date.now()}-${safe}`;
    const path = join(UPLOADS_LMS, name);
    await writeFile(path, buf);
    return reply.send({ url: `/uploads/lms/${name}` });
  });
}
