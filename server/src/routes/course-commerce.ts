import { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { courses, payments } from '../db/schema.js';
import { getAuthFromRequest } from '../lib/auth.js';
import { generatePaymentUrl, isRobokassaConfigured } from '../lib/robokassa.js';
import {
  createCourseOrder,
  getCourseByCode,
  getEffectiveCourseAccess,
  listActiveCourses,
} from '../lib/course-access.js';
import { getSetting } from '../lib/billing.js';

function parseRubAmount(value: string | null | undefined, fallback: number): number {
  const parsed = Number(value ?? '');
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

async function getConfiguredPrice(courseCode: string): Promise<number> {
  if (courseCode === 'course_14') {
    return parseRubAmount(await getSetting('course_14_price_rub'), 10500);
  }
  if (courseCode === 'course_21') {
    return parseRubAmount(await getSetting('course_21_price_rub'), 14500);
  }
  return 0;
}

async function getUpgradePrice(): Promise<number> {
  return parseRubAmount(await getSetting('course_21_upgrade_price_rub'), 4000);
}

export async function courseCommerceRoutes(app: FastifyInstance) {
  app.get('/courses', async (req, reply) => {
    const rows = await listActiveCourses();
    const [price14, price21, upgradePrice] = await Promise.all([
      getConfiguredPrice('course_14'),
      getConfiguredPrice('course_21'),
      getUpgradePrice(),
    ]);

    return reply.send(rows.map((course) => ({
      ...course,
      priceRub: course.code === 'course_14' ? price14.toFixed(2) : course.code === 'course_21' ? price21.toFixed(2) : course.priceRub,
      upgradePriceRub: course.code === 'course_21' ? upgradePrice.toFixed(2) : null,
    })));
  });

  app.get<{ Querystring: { userId?: string } }>('/course-access', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload) {
      return reply.status(401).send({ error: 'Не авторизован' });
    }

    const targetUserId = payload.role === 'admin' && req.query.userId ? req.query.userId : payload.userId;
    const access = await getEffectiveCourseAccess(targetUserId);
    return reply.send(access);
  });

  app.post<{ Body: { courseCode: string } }>('/course-orders', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload) {
      return reply.status(401).send({ error: 'Не авторизован' });
    }

    if (!isRobokassaConfigured()) {
      return reply.status(503).send({ error: 'Оплата временно недоступна: Robokassa не настроена на сервере' });
    }

    const courseCode = req.body?.courseCode?.trim();
    if (!courseCode) {
      return reply.status(400).send({ error: 'courseCode обязателен' });
    }

    const targetCourse = await getCourseByCode(courseCode);
    if (!targetCourse || !targetCourse.isActive) {
      return reply.status(404).send({ error: 'Курс не найден' });
    }

    const access = await getEffectiveCourseAccess(payload.userId);
    if (targetCourse.code === 'course_14' && access.grantedLessons >= 14) {
      return reply.status(400).send({ error: 'У вас уже есть доступ к базовому курсу' });
    }
    if (targetCourse.code === 'course_21' && access.grantedLessons >= 21) {
      return reply.status(400).send({ error: 'У вас уже есть доступ к полному курсу' });
    }

    let orderType: 'purchase' | 'upgrade' = 'purchase';
    let expectedAmount = await getConfiguredPrice(targetCourse.code);
    let sourceCourseId: string | null = null;

    if (targetCourse.code === 'course_21' && access.grantedLessons >= 14 && access.grantedLessons < 21) {
      orderType = 'upgrade';
      expectedAmount = await getUpgradePrice();
      const currentCourse = access.courseCode ? await getCourseByCode(access.courseCode) : null;
      sourceCourseId = currentCourse?.id ?? null;
    }

    if (expectedAmount <= 0) {
      return reply.status(400).send({ error: 'Стоимость курса настроена некорректно' });
    }

    const order = await createCourseOrder({
      userId: payload.userId,
      courseId: targetCourse.id,
      sourceCourseId,
      orderType,
      expectedAmountRub: expectedAmount.toFixed(2),
    });

    const [payment] = await db.insert(payments).values({
      userId: payload.userId,
      amount: expectedAmount.toFixed(2),
      paymentType: orderType === 'upgrade' ? 'course_upgrade' : 'course_purchase',
      courseOrderId: order.id,
      status: 'pending',
    }).returning();

    const description = orderType === 'upgrade'
      ? `Апгрейд курса до 21 дня`
      : targetCourse.code === 'course_14'
        ? 'Покупка курса 14 дней'
        : 'Покупка курса 21 день';

    const paymentUrl = generatePaymentUrl(expectedAmount, payment.invId, description);
    return reply.send({
      orderId: order.id,
      courseCode: targetCourse.code,
      orderType,
      expectedAmountRub: expectedAmount.toFixed(2),
      paymentUrl,
      invId: payment.invId,
    });
  });

  app.get('/admin/course-orders', async (req, reply) => {
    const payload = getAuthFromRequest(req);
    if (!payload || payload.role !== 'admin') {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const rows = await db.select().from(payments).where(eq(payments.paymentType, 'course_purchase'));
    return reply.send(rows);
  });
}
