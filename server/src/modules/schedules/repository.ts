import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

import type {
  ScheduleRecord,
  ScheduleReminderMinutesBefore,
  ScheduleVisitStatus,
} from './types.js';

export type SchedulesRepository = {
  listByUser: (input: {
    userId: string;
    from: string;
    to: string;
  }) => ScheduleRecord[];
  findById: (id: string) => ScheduleRecord | null;
  create: (input: {
    userId: string;
    title: string;
    memo?: string | null;
    scheduledAt: string;
    placeId?: string | null;
    reminderMinutesBefore?: ScheduleReminderMinutesBefore | null;
    visitStatus?: ScheduleVisitStatus;
  }) => ScheduleRecord;
  update: (
    id: string,
    patch: {
      title?: string;
      memo?: string | null;
      scheduledAt?: string;
      placeId?: string | null;
      reminderMinutesBefore?: ScheduleReminderMinutesBefore | null;
      visitStatus?: ScheduleVisitStatus;
    },
  ) => ScheduleRecord | null;
  softDelete: (id: string) => ScheduleRecord | null;
  existsActiveByPlaceId: (input: { userId: string; placeId: string }) => boolean;
};

export class InMemorySchedulesRepository implements SchedulesRepository {
  private readonly schedules = new Map<string, ScheduleRecord>();

  listByUser(input: {
    userId: string;
    from: string;
    to: string;
  }): ScheduleRecord[] {
    return [...this.schedules.values()]
      .filter(
        schedule =>
          schedule.userId === input.userId &&
          !schedule.deletedAt &&
          schedule.scheduledAt >= input.from &&
          schedule.scheduledAt <= input.to,
      )
      .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt));
  }

  findById(id: string): ScheduleRecord | null {
    return this.schedules.get(id) ?? null;
  }

  create(input: {
    userId: string;
    title: string;
    memo?: string | null;
    scheduledAt: string;
    placeId?: string | null;
    reminderMinutesBefore?: ScheduleReminderMinutesBefore | null;
    visitStatus?: ScheduleVisitStatus;
  }): ScheduleRecord {
    const now = new Date().toISOString();
    const record: ScheduleRecord = {
      id: randomUUID(),
      userId: input.userId,
      title: input.title,
      memo: input.memo ?? null,
      scheduledAt: input.scheduledAt,
      placeId: input.placeId ?? null,
      reminderMinutesBefore: input.reminderMinutesBefore ?? null,
      visitStatus: input.visitStatus ?? 'planned',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    this.schedules.set(record.id, record);

    return record;
  }

  update(
    id: string,
    patch: {
      title?: string;
      memo?: string | null;
      scheduledAt?: string;
      placeId?: string | null;
      reminderMinutesBefore?: ScheduleReminderMinutesBefore | null;
      visitStatus?: ScheduleVisitStatus;
    },
  ): ScheduleRecord | null {
    const existingSchedule = this.schedules.get(id);

    if (!existingSchedule) {
      return null;
    }

    const nextSchedule: ScheduleRecord = {
      ...existingSchedule,
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    this.schedules.set(id, nextSchedule);

    return nextSchedule;
  }

  softDelete(id: string): ScheduleRecord | null {
    const existingSchedule = this.schedules.get(id);

    if (!existingSchedule || existingSchedule.deletedAt) {
      return null;
    }

    const deletedAt = new Date().toISOString();
    const nextSchedule: ScheduleRecord = {
      ...existingSchedule,
      updatedAt: deletedAt,
      deletedAt,
    };

    this.schedules.set(id, nextSchedule);

    return nextSchedule;
  }

  existsActiveByPlaceId(input: { userId: string; placeId: string }): boolean {
    return [...this.schedules.values()].some(schedule => {
      return (
        schedule.userId === input.userId &&
        !schedule.deletedAt &&
        schedule.placeId === input.placeId
      );
    });
  }
}

export class SQLiteSchedulesRepository implements SchedulesRepository {
  constructor(private readonly database: DatabaseSync) {}

  listByUser(input: {
    userId: string;
    from: string;
    to: string;
  }): ScheduleRecord[] {
    return this.database
      .prepare(
        `
          SELECT
            id,
            user_id AS userId,
            title,
            memo,
            scheduled_at AS scheduledAt,
            place_id AS placeId,
            reminder_minutes_before AS reminderMinutesBefore,
            visit_status AS visitStatus,
            created_at AS createdAt,
            updated_at AS updatedAt,
            deleted_at AS deletedAt
          FROM schedules
          WHERE
            user_id = ?
            AND deleted_at IS NULL
            AND scheduled_at >= ?
            AND scheduled_at <= ?
          ORDER BY scheduled_at ASC
        `,
      )
      .all(input.userId, input.from, input.to)
      .map(mapScheduleRow);
  }

  findById(id: string): ScheduleRecord | null {
    const row = this.database
      .prepare(
        `
          SELECT
            id,
            user_id AS userId,
            title,
            memo,
            scheduled_at AS scheduledAt,
            place_id AS placeId,
            reminder_minutes_before AS reminderMinutesBefore,
            visit_status AS visitStatus,
            created_at AS createdAt,
            updated_at AS updatedAt,
            deleted_at AS deletedAt
          FROM schedules
          WHERE id = ?
        `,
      )
      .get(id);

    return row ? mapScheduleRow(row) : null;
  }

  create(input: {
    userId: string;
    title: string;
    memo?: string | null;
    scheduledAt: string;
    placeId?: string | null;
    reminderMinutesBefore?: ScheduleReminderMinutesBefore | null;
    visitStatus?: ScheduleVisitStatus;
  }): ScheduleRecord {
    const now = new Date().toISOString();
    const record: ScheduleRecord = {
      id: randomUUID(),
      userId: input.userId,
      title: input.title,
      memo: input.memo ?? null,
      scheduledAt: input.scheduledAt,
      placeId: input.placeId ?? null,
      reminderMinutesBefore: input.reminderMinutesBefore ?? null,
      visitStatus: input.visitStatus ?? 'planned',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    this.database
      .prepare(
        `
          INSERT INTO schedules (
            id,
            user_id,
            title,
            memo,
            scheduled_at,
            place_id,
            reminder_minutes_before,
            visit_status,
            created_at,
            updated_at,
            deleted_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        record.id,
        record.userId,
        record.title,
        record.memo,
        record.scheduledAt,
        record.placeId,
        record.reminderMinutesBefore,
        record.visitStatus,
        record.createdAt,
        record.updatedAt,
        record.deletedAt,
      );

    return record;
  }

  update(
    id: string,
    patch: {
      title?: string;
      memo?: string | null;
      scheduledAt?: string;
      placeId?: string | null;
      reminderMinutesBefore?: ScheduleReminderMinutesBefore | null;
      visitStatus?: ScheduleVisitStatus;
    },
  ): ScheduleRecord | null {
    const existingSchedule = this.findById(id);

    if (!existingSchedule) {
      return null;
    }

    const nextSchedule: ScheduleRecord = {
      ...existingSchedule,
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    this.database
      .prepare(
        `
          UPDATE schedules
          SET
            title = ?,
            memo = ?,
            scheduled_at = ?,
            place_id = ?,
            reminder_minutes_before = ?,
            visit_status = ?,
            updated_at = ?,
            deleted_at = ?
          WHERE id = ?
        `,
      )
      .run(
        nextSchedule.title,
        nextSchedule.memo,
        nextSchedule.scheduledAt,
        nextSchedule.placeId,
        nextSchedule.reminderMinutesBefore,
        nextSchedule.visitStatus,
        nextSchedule.updatedAt,
        nextSchedule.deletedAt,
        id,
      );

    return nextSchedule;
  }

  softDelete(id: string): ScheduleRecord | null {
    const existingSchedule = this.findById(id);

    if (!existingSchedule || existingSchedule.deletedAt) {
      return null;
    }

    const deletedAt = new Date().toISOString();
    const nextSchedule: ScheduleRecord = {
      ...existingSchedule,
      updatedAt: deletedAt,
      deletedAt,
    };

    this.database
      .prepare(
        `
          UPDATE schedules
          SET updated_at = ?, deleted_at = ?
          WHERE id = ?
        `,
      )
      .run(nextSchedule.updatedAt, nextSchedule.deletedAt, id);

    return nextSchedule;
  }

  existsActiveByPlaceId(input: { userId: string; placeId: string }): boolean {
    const row = this.database
      .prepare(
        `
          SELECT 1
          FROM schedules
          WHERE
            user_id = ?
            AND place_id = ?
            AND deleted_at IS NULL
          LIMIT 1
        `,
      )
      .get(input.userId, input.placeId);

    return Boolean(row);
  }
}

function mapScheduleRow(row: Record<string, unknown>): ScheduleRecord {
  return {
    id: String(row.id),
    userId: String(row.userId),
    title: String(row.title),
    memo: (row.memo as string | null | undefined) ?? null,
    scheduledAt: String(row.scheduledAt),
    placeId: (row.placeId as string | null | undefined) ?? null,
    reminderMinutesBefore: mapReminderMinutesBefore(row.reminderMinutesBefore),
    visitStatus: row.visitStatus as ScheduleVisitStatus,
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
    deletedAt: (row.deletedAt as string | null | undefined) ?? null,
  };
}

function mapReminderMinutesBefore(
  value: unknown,
): ScheduleReminderMinutesBefore | null {
  if (value === 0 || value === 60 || value === 1440) {
    return value;
  }

  return null;
}
