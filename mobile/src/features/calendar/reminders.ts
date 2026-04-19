import type {
  ScheduleReminderMinutesBefore,
  ScheduleSummary,
} from './types';

export function buildScheduleReminderKey(
  schedule: Pick<
    ScheduleSummary,
    'id' | 'scheduledAt' | 'reminderMinutesBefore'
  >,
): string {
  return `${schedule.id}:${schedule.scheduledAt}:${
    schedule.reminderMinutesBefore ?? 'none'
  }`;
}

export function buildReminderFetchRange(now: Date): {
  from: string;
  to: string;
} {
  return {
    from: formatDate(now),
    to: formatDate(addDays(now, 1)),
  };
}

export function buildNotificationSyncRange(now: Date): {
  from: string;
  to: string;
} {
  return {
    from: formatDate(now),
    to: '2028-12-31',
  };
}

export function findDueScheduleReminder(
  schedules: ScheduleSummary[],
  now: Date,
  seenReminderKeys: ReadonlySet<string>,
): ScheduleSummary | null {
  return (
    schedules
      .filter(schedule => isReminderDue(schedule, now))
      .filter(schedule => !seenReminderKeys.has(buildScheduleReminderKey(schedule)))
      .sort((left, right) => {
        return buildReminderAt(left).localeCompare(buildReminderAt(right));
      })[0] ?? null
  );
}

export function extractScheduleDateKey(scheduledAt: string): string {
  return formatDate(new Date(scheduledAt));
}

export function getReminderLabelKey(
  reminderMinutesBefore: ScheduleReminderMinutesBefore | null,
):
  | 'calendar_reminder_none'
  | 'calendar_reminder_at_time'
  | 'calendar_reminder_one_hour'
  | 'calendar_reminder_one_day' {
  switch (reminderMinutesBefore) {
    case 0:
      return 'calendar_reminder_at_time';
    case 60:
      return 'calendar_reminder_one_hour';
    case 1440:
      return 'calendar_reminder_one_day';
    case null:
    default:
      return 'calendar_reminder_none';
  }
}

export function formatReminderTimeLabel(isoString: string): string {
  const date = new Date(isoString);

  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function isReminderDue(schedule: ScheduleSummary, now: Date): boolean {
  if (schedule.reminderMinutesBefore === null) {
    return false;
  }

  const scheduledAt = new Date(schedule.scheduledAt);

  if (Number.isNaN(scheduledAt.getTime()) || now > scheduledAt) {
    return false;
  }

  return buildReminderAt(schedule) <= now.toISOString();
}

function buildReminderAt(schedule: ScheduleSummary): string {
  const scheduledAt = new Date(schedule.scheduledAt);

  return new Date(
    scheduledAt.getTime() - schedule.reminderMinutesBefore! * 60 * 1000,
  ).toISOString();
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
