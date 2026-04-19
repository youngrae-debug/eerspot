export type ScheduleVisitStatus = 'planned' | 'visited' | 'skipped';
export type ScheduleRepeatFrequency = 'none' | 'weekly' | 'monthly';
export type ScheduleReminderMinutesBefore = 0 | 60 | 1440;

export type ScheduleRecord = {
  id: string;
  userId: string;
  title: string;
  memo: string | null;
  scheduledAt: string;
  placeId: string | null;
  reminderMinutesBefore: ScheduleReminderMinutesBefore | null;
  visitStatus: ScheduleVisitStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type ScheduleListItem = Pick<
  ScheduleRecord,
  'id' | 'title' | 'scheduledAt' | 'visitStatus' | 'placeId' | 'reminderMinutesBefore'
>;
