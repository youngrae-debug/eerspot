export type ScheduleVisitStatus = 'planned' | 'visited' | 'skipped';

export type ScheduleSummary = {
  id: string;
  title: string;
  scheduledAt: string;
  visitStatus: ScheduleVisitStatus;
  placeId: string | null;
};

export type ScheduleDetail = ScheduleSummary & {
  memo: string | null;
};
