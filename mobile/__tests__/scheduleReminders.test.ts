import {
  buildReminderFetchRange,
  buildScheduleReminderKey,
  extractScheduleDateKey,
  findDueScheduleReminder,
} from '../src/features/calendar/reminders';

test('finds a due reminder when its reminder window has started', () => {
  const dueReminder = findDueScheduleReminder(
    [
      {
        id: 'sch_due',
        placeId: null,
        reminderMinutesBefore: 60,
        scheduledAt: '2026-03-25T10:00:00.000Z',
        title: 'Morning coffee',
        visitStatus: 'planned',
      },
      {
        id: 'sch_later',
        placeId: null,
        reminderMinutesBefore: 60,
        scheduledAt: '2026-03-25T13:00:00.000Z',
        title: 'Lunch',
        visitStatus: 'planned',
      },
    ],
    new Date('2026-03-25T09:10:00.000Z'),
    new Set(),
  );

  expect(dueReminder?.id).toBe('sch_due');
});

test('ignores reminders already seen in this session', () => {
  const schedule = {
    id: 'sch_due',
    placeId: null,
    reminderMinutesBefore: 0 as const,
    scheduledAt: '2026-03-25T10:00:00.000Z',
    title: 'Morning coffee',
    visitStatus: 'planned' as const,
  };

  expect(
    findDueScheduleReminder(
      [schedule],
      new Date('2026-03-25T10:00:00.000Z'),
      new Set([buildScheduleReminderKey(schedule)]),
    ),
  ).toBeNull();
});

test('builds the fetch range and date key using local calendar dates', () => {
  expect(buildReminderFetchRange(new Date(2026, 2, 25, 9, 0, 0, 0))).toEqual({
    from: '2026-03-25',
    to: '2026-03-26',
  });
  expect(extractScheduleDateKey('2026-03-25T10:00:00.000Z')).toBe('2026-03-25');
});
