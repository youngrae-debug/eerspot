import type { RequestOptions } from '../../../shared/api/http';

import type { ScheduleDetail, ScheduleSummary, ScheduleVisitStatus } from '../types';

type AuthorizedRequest = <T>(
  path: string,
  options?: RequestOptions,
) => Promise<T>;

type ScheduleInput = {
  title: string;
  scheduledAt: string;
  memo: string | null;
  placeId: string | null;
};

export async function listSchedules(
  authorizedRequest: AuthorizedRequest,
  input: {
    from: string;
    to: string;
  },
): Promise<{
  items: ScheduleSummary[];
}> {
  return authorizedRequest(
    `/schedules?from=${encodeURIComponent(input.from)}&to=${encodeURIComponent(
      input.to,
    )}`,
  );
}

export async function getSchedule(
  authorizedRequest: AuthorizedRequest,
  scheduleId: string,
): Promise<ScheduleDetail> {
  return authorizedRequest(`/schedules/${scheduleId}`);
}

export async function createSchedule(
  authorizedRequest: AuthorizedRequest,
  input: ScheduleInput,
): Promise<{ id: string }> {
  return authorizedRequest('/schedules', {
    method: 'POST',
    body: input,
  });
}

export async function updateSchedule(
  authorizedRequest: AuthorizedRequest,
  input: ScheduleInput & {
    id: string;
    visitStatus: ScheduleVisitStatus;
  },
): Promise<{
  id: string;
  updated: boolean;
}> {
  return authorizedRequest(`/schedules/${input.id}`, {
    method: 'PATCH',
    body: {
      title: input.title,
      scheduledAt: input.scheduledAt,
      memo: input.memo,
      placeId: input.placeId,
      visitStatus: input.visitStatus,
    },
  });
}

export async function deleteSchedule(
  authorizedRequest: AuthorizedRequest,
  scheduleId: string,
): Promise<void> {
  await authorizedRequest(`/schedules/${scheduleId}`, {
    method: 'DELETE',
  });
}
