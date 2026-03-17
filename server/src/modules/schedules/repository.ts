import { randomUUID } from 'node:crypto';

import type { ScheduleRecord, ScheduleVisitStatus } from './types.js';

export class InMemorySchedulesRepository {
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
}
