export type ScheduleVisitStatus = 'planned' | 'visited' | 'skipped';
export type ScheduleRepeatFrequency = 'none' | 'weekly' | 'monthly';
export type ScheduleReminderMinutesBefore = 0 | 60 | 1440;

export type ScheduleSummary = {
  id: string;
  title: string;
  scheduledAt: string;
  visitStatus: ScheduleVisitStatus;
  placeId: string | null;
  reminderMinutesBefore: ScheduleReminderMinutesBefore | null;
};

export type ScheduleDetail = ScheduleSummary & {
  memo: string | null;
};
