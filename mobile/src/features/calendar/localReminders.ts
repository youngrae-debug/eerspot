import { NativeModules, Platform } from 'react-native';

import {
  formatReminderTimeLabel,
  getReminderLabelKey,
} from './reminders';
import type { ScheduleSummary } from './types';

type Translate = (
  key:
    | 'calendar_reminder_banner_title'
    | 'calendar_reminder_banner_message'
    | 'calendar_reminder_none'
    | 'calendar_reminder_at_time'
    | 'calendar_reminder_one_hour'
    | 'calendar_reminder_one_day',
  params?: Record<string, number | string>,
) => string;

type NativeScheduleReminderModule = {
  syncReminders?: (
    reminders: Array<{
      body: string;
      fireDate: string;
      identifier: string;
      title: string;
    }>,
  ) => Promise<void>;
};

const nativeScheduleReminderModule =
  NativeModules.ScheduleReminderModule as NativeScheduleReminderModule | null;

export async function syncLocalScheduleReminders(
  schedules: ScheduleSummary[],
  t: Translate,
): Promise<void> {
  if (
    Platform.OS !== 'ios' ||
    !nativeScheduleReminderModule?.syncReminders
  ) {
    return;
  }

  const reminders = schedules
    .filter(schedule => schedule.reminderMinutesBefore !== null)
    .map(schedule => {
      const scheduledAt = new Date(schedule.scheduledAt);
      const fireDate = new Date(
        scheduledAt.getTime() - schedule.reminderMinutesBefore! * 60 * 1000,
      );

      return {
        body: t('calendar_reminder_banner_message', {
          title: schedule.title,
          time: formatReminderTimeLabel(schedule.scheduledAt),
          offsetLabel: t(getReminderLabelKey(schedule.reminderMinutesBefore)),
        }),
        fireDate: fireDate.toISOString(),
        identifier: `eerspot.schedule.${schedule.id}.${schedule.reminderMinutesBefore}.${schedule.scheduledAt}`,
        title: t('calendar_reminder_banner_title'),
      };
    });

  await nativeScheduleReminderModule.syncReminders(reminders);
}
