import { AppError } from '../../lib/http/errors.js';
import type { PlacesService } from '../places/service.js';

import type { SchedulesRepository } from './repository.js';
import type {
  ScheduleListItem,
  ScheduleRecord,
  ScheduleRepeatFrequency,
  ScheduleReminderMinutesBefore,
  ScheduleVisitStatus,
} from './types.js';

const RECURRING_SERIES_END = '2028-12-31T23:59:59.999Z';

export class SchedulesService {
  constructor(
    private readonly repository: SchedulesRepository,
    private readonly placesService: PlacesService,
  ) {}

  async createSchedule(input: {
    userId: string;
    title: string;
    memo?: string | null;
    scheduledAt: string;
    placeId?: string | null;
    repeatFrequency?: ScheduleRepeatFrequency;
    reminderMinutesBefore?: ScheduleReminderMinutesBefore | null;
  }): Promise<{ id: string; createdCount: number }> {
    if (input.placeId) {
      await this.placesService.getPlace(input.userId, input.placeId);
    }

    const normalizedMemo = normalizeMemo(input.memo);
    const scheduledAtValues = buildScheduleSeries(
      input.scheduledAt,
      input.repeatFrequency ?? 'none',
    );
    const firstSchedule = this.repository.create({
      userId: input.userId,
      title: input.title,
      memo: normalizedMemo,
      scheduledAt: scheduledAtValues[0],
      placeId: input.placeId ?? null,
      reminderMinutesBefore: input.reminderMinutesBefore ?? null,
    });

    scheduledAtValues.slice(1).forEach(scheduledAt => {
      this.repository.create({
        userId: input.userId,
        title: input.title,
        memo: normalizedMemo,
        scheduledAt,
        placeId: input.placeId ?? null,
        reminderMinutesBefore: input.reminderMinutesBefore ?? null,
      });
    });

    return {
      id: firstSchedule.id,
      createdCount: scheduledAtValues.length,
    };
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
    reminderMinutesBefore: ScheduleReminderMinutesBefore | null;
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
    reminderMinutesBefore?: ScheduleReminderMinutesBefore | null;
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
      ...(input.reminderMinutesBefore !== undefined
        ? { reminderMinutesBefore: input.reminderMinutesBefore }
        : {}),
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

function buildScheduleSeries(
  scheduledAt: string,
  repeatFrequency: ScheduleRepeatFrequency,
): string[] {
  const baseDate = new Date(scheduledAt);

  if (Number.isNaN(baseDate.getTime())) {
    throw new AppError(400, 'VALIDATION_ERROR', 'invalid datetime');
  }

  if (repeatFrequency === 'none') {
    return [baseDate.toISOString()];
  }

  const seriesEnd = new Date(RECURRING_SERIES_END);

  if (baseDate > seriesEnd) {
    return [baseDate.toISOString()];
  }

  const occurrences: string[] = [];
  const preferredDayOfMonth = baseDate.getUTCDate();
  let cursor = new Date(baseDate);

  while (cursor <= seriesEnd) {
    occurrences.push(cursor.toISOString());
    cursor =
      repeatFrequency === 'weekly'
        ? addWeeksUtc(cursor, 1)
        : addMonthsUtc(cursor, 1, preferredDayOfMonth);
  }

  return occurrences;
}

function addWeeksUtc(date: Date, weeks: number): Date {
  return new Date(date.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);
}

function addMonthsUtc(
  date: Date,
  months: number,
  preferredDayOfMonth: number,
): Date {
  const targetMonthStart = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth() + months,
      1,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
  const targetYear = targetMonthStart.getUTCFullYear();
  const targetMonthIndex = targetMonthStart.getUTCMonth();
  const lastDayOfTargetMonth = new Date(
    Date.UTC(targetYear, targetMonthIndex + 1, 0),
  ).getUTCDate();

  return new Date(
    Date.UTC(
      targetYear,
      targetMonthIndex,
      Math.min(preferredDayOfMonth, lastDayOfTargetMonth),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
}

function toListItem(schedule: ScheduleRecord): ScheduleListItem {
  return {
    id: schedule.id,
    title: schedule.title,
    scheduledAt: schedule.scheduledAt,
    visitStatus: schedule.visitStatus,
    placeId: schedule.placeId,
    reminderMinutesBefore: schedule.reminderMinutesBefore,
  };
}

function toDetailItem(schedule: ScheduleRecord) {
  return {
    id: schedule.id,
    title: schedule.title,
    memo: schedule.memo,
    scheduledAt: schedule.scheduledAt,
    reminderMinutesBefore: schedule.reminderMinutesBefore,
    visitStatus: schedule.visitStatus,
    placeId: schedule.placeId,
  };
}
