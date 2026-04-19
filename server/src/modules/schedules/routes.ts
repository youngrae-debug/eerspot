import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import type { AuthService } from '../auth/service.js';
import type { SchedulesService } from './service.js';

const scheduleVisitStatusSchema = z.enum(['planned', 'visited', 'skipped']);
const scheduleRepeatFrequencySchema = z.enum(['none', 'weekly', 'monthly']);
const scheduleReminderMinutesBeforeSchema = z.union([
  z.literal(0),
  z.literal(60),
  z.literal(1440),
]);

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const datetimeSchema = z.string().trim().refine(isValidDatetime, {
  message: 'invalid datetime',
});

const createScheduleSchema = z.object({
  title: z.string().trim().min(1),
  scheduledAt: datetimeSchema,
  memo: z.union([z.string(), z.null()]).optional(),
  placeId: z.union([z.string().uuid(), z.null()]).optional(),
  repeatFrequency: scheduleRepeatFrequencySchema.optional(),
  reminderMinutesBefore: z
    .union([scheduleReminderMinutesBeforeSchema, z.null()])
    .optional(),
});

const updateScheduleSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    scheduledAt: datetimeSchema.optional(),
    memo: z.union([z.string(), z.null()]).optional(),
    placeId: z.union([z.string().uuid(), z.null()]).optional(),
    reminderMinutesBefore: z
      .union([scheduleReminderMinutesBeforeSchema, z.null()])
      .optional(),
    visitStatus: scheduleVisitStatusSchema.optional(),
  })
  .refine(
    body =>
      body.title !== undefined ||
      body.scheduledAt !== undefined ||
      body.memo !== undefined ||
      body.placeId !== undefined ||
      body.reminderMinutesBefore !== undefined ||
      body.visitStatus !== undefined,
    {
      message: 'at least one field is required',
    },
  );

const listSchedulesQuerySchema = z.object({
  from: dateSchema,
  to: dateSchema,
});

const scheduleIdParamsSchema = z.object({
  id: z.string().uuid(),
});

type SchedulesRoutesOptions = {
  authService: AuthService;
  schedulesService: SchedulesService;
};

export const schedulesRoutes: FastifyPluginAsync<SchedulesRoutesOptions> = async (
  app,
  { authService, schedulesService },
) => {
  app.post('/', async (request, reply) => {
    const viewer = await authService.authenticate(request.headers.authorization);
    const body = createScheduleSchema.parse(request.body);
    const data = await schedulesService.createSchedule({
      ...body,
      userId: viewer.id,
    });

    return reply.code(201).send({ data });
  });

  app.get('/', async request => {
    const viewer = await authService.authenticate(request.headers.authorization);
    const query = listSchedulesQuerySchema.parse(request.query);
    const data = await schedulesService.listSchedules({
      userId: viewer.id,
      ...query,
    });

    return { data };
  });

  app.get('/:id', async request => {
    const viewer = await authService.authenticate(request.headers.authorization);
    const params = scheduleIdParamsSchema.parse(request.params);
    const data = await schedulesService.getSchedule(viewer.id, params.id);

    return { data };
  });

  app.patch('/:id', async request => {
    const viewer = await authService.authenticate(request.headers.authorization);
    const params = scheduleIdParamsSchema.parse(request.params);
    const body = updateScheduleSchema.parse(request.body);
    const data = await schedulesService.updateSchedule({
      ...body,
      userId: viewer.id,
      scheduleId: params.id,
    });

    return { data };
  });

  app.delete('/:id', async (request, reply) => {
    const viewer = await authService.authenticate(request.headers.authorization);
    const params = scheduleIdParamsSchema.parse(request.params);

    await schedulesService.deleteSchedule(viewer.id, params.id);

    return reply.code(204).send();
  });
};

function isValidDatetime(value: string): boolean {
  return value.includes('T') && !Number.isNaN(Date.parse(value));
}
