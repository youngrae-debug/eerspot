export type ScheduleVisitStatus = 'planned' | 'visited' | 'skipped';

export type ScheduleRecord = {
  id: string;
  userId: string;
  title: string;
  memo: string | null;
  scheduledAt: string;
  placeId: string | null;
  visitStatus: ScheduleVisitStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type ScheduleListItem = Pick<
  ScheduleRecord,
  'id' | 'title' | 'scheduledAt' | 'visitStatus' | 'placeId'
>;
