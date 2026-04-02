import { AppError } from '../../lib/http/errors.js';
import type { PlacesService } from '../places/service.js';

import { InMemorySchedulesRepository } from './repository.js';
import type { ScheduleListItem, ScheduleRecord, ScheduleVisitStatus } from './types.js';

export class SchedulesService {
  constructor(
    private readonly repository: InMemorySchedulesRepository,
    private readonly placesService: PlacesService,
  ) {}

  async createSchedule(input: {
    userId: string;
    title: string;
    memo?: string | null;
    scheduledAt: string;
    placeId?: string | null;
  }): Promise<{ id: string }> {
    if (input.placeId) {
      await this.placesService.getPlace(input.userId, input.placeId);
    }

    const schedule = this.repository.create({
      userId: input.userId,
      title: input.title,
      memo: normalizeMemo(input.memo),
      scheduledAt: input.scheduledAt,
      placeId: input.placeId ?? null,
    });

    return { id: schedule.id };
  }

  async listSchedules(input: {
    userId: string;
    from: string;
    to: string;
  }): Promise<{ items: ScheduleListItem[] }> {
    const range = normalizeListRange(input.from, input.to);
    const items = this.repository
      .listByUser({
        userId: input.userId,
        from: range.from,
        to: range.to,
      })
      .map(toListItem);

    return { items };
  }

  async getSchedule(userId: string, scheduleId: string): Promise<{
    id: string;
    title: string;
    memo: string | null;
    scheduledAt: string;
    visitStatus: ScheduleVisitStatus;
    placeId: string | null;
  }> {
    return toDetailItem(this.getOwnedSchedule(userId, scheduleId));
  }

  async updateSchedule(input: {
    userId: string;
    scheduleId: string;
    title?: string;
    memo?: string | null;
    scheduledAt?: string;
    placeId?: string | null;
    visitStatus?: ScheduleVisitStatus;
  }): Promise<{ id: string; updated: true }> {
    this.getOwnedSchedule(input.userId, input.scheduleId);

    if (input.placeId) {
      await this.placesService.getPlace(input.userId, input.placeId);
    }

    const nextSchedule = this.repository.update(input.scheduleId, {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.memo !== undefined ? { memo: normalizeMemo(input.memo) } : {}),
      ...(input.scheduledAt !== undefined
        ? { scheduledAt: input.scheduledAt }
        : {}),
      ...(input.placeId !== undefined ? { placeId: input.placeId } : {}),
      ...(input.visitStatus !== undefined
        ? { visitStatus: input.visitStatus }
        : {}),
    });

    if (!nextSchedule || nextSchedule.deletedAt) {
      throw new AppError(404, 'NOT_FOUND', 'schedule not found');
    }

    return {
      id: nextSchedule.id,
      updated: true,
    };
  }

  async deleteSchedule(userId: string, scheduleId: string): Promise<void> {
    this.getOwnedSchedule(userId, scheduleId);

    const deletedSchedule = this.repository.softDelete(scheduleId);

    if (!deletedSchedule) {
      throw new AppError(404, 'NOT_FOUND', 'schedule not found');
    }
  }

  hasActiveSchedulesForPlace(userId: string, placeId: string): boolean {
    return this.repository.existsActiveByPlaceId({ userId, placeId });
  }

  private getOwnedSchedule(userId: string, scheduleId: string): ScheduleRecord {
    const schedule = this.repository.findById(scheduleId);

    if (!schedule || schedule.deletedAt || schedule.userId !== userId) {
      throw new AppError(404, 'NOT_FOUND', 'schedule not found');
    }

    return schedule;
  }
}

function normalizeListRange(from: string, to: string) {
  const normalizedRange = {
    from: `${from}T00:00:00.000Z`,
    to: `${to}T23:59:59.999Z`,
  };

  if (
    Number.isNaN(Date.parse(normalizedRange.from)) ||
    Number.isNaN(Date.parse(normalizedRange.to))
  ) {
    throw new AppError(400, 'VALIDATION_ERROR', 'invalid schedule range');
  }

  if (normalizedRange.from > normalizedRange.to) {
    throw new AppError(400, 'VALIDATION_ERROR', 'from must be on or before to');
  }

  return normalizedRange;
}

function normalizeMemo(memo: string | null | undefined): string | null {
  if (memo === null || memo === undefined) {
    return null;
  }

  const trimmedMemo = memo.trim();

  return trimmedMemo ? trimmedMemo : null;
}

function toListItem(schedule: ScheduleRecord): ScheduleListItem {
  return {
    id: schedule.id,
    title: schedule.title,
    scheduledAt: schedule.scheduledAt,
    visitStatus: schedule.visitStatus,
    placeId: schedule.placeId,
  };
}

function toDetailItem(schedule: ScheduleRecord) {
  return {
    id: schedule.id,
    title: schedule.title,
    memo: schedule.memo,
    scheduledAt: schedule.scheduledAt,
    visitStatus: schedule.visitStatus,
    placeId: schedule.placeId,
  };
}
