import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useLanguage } from '../../../shared/i18n/LanguageContext';
import type { Language } from '../../../shared/i18n/messages';
import { colors } from '../../../shared/theme/colors';
import { useAuth } from '../../auth/context/AuthContext';
import { listSchedules } from '../api/schedulesApi';
import type { ScheduleSummary } from '../types';

type CalendarConfig = {
  monthCount: number;
  startMonthIndex: number;
  startYear: number;
};

type CalendarDay = {
  dateKey: string;
  dayNumber: number;
  inCurrentMonth: boolean;
  isSaturday: boolean;
  isSunday: boolean;
};

type CalendarMonth = {
  key: string;
  label: string;
  weeks: CalendarDay[][];
};

const CALENDAR_START_YEAR = 2026;
const CALENDAR_START_MONTH_INDEX = 0;
const CALENDAR_END_YEAR = 2028;
const CALENDAR_END_MONTH_INDEX = 11;
const MONTH_SCROLL_TOP_GAP = 28;
const ENGLISH_MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;
const WEEKDAY_LABELS: Record<Language, string[]> = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  ko: ['일', '월', '화', '수', '목', '금', '토'],
  ja: ['日', '月', '火', '水', '木', '金', '土'],
};

type CalendarScreenProps = {
  bottomInset: number;
  focusRequestKey: number;
};

export function CalendarScreen({
  bottomInset,
  focusRequestKey,
}: CalendarScreenProps): React.JSX.Element {
  const { authorizedRequest } = useAuth();
  const { language, t } = useLanguage();
  const calendarConfig = useMemo(() => getCalendarConfig(), []);
  const calendarMonths = useMemo(() => {
    return buildCalendarMonths(calendarConfig, language);
  }, [calendarConfig, language]);
  const calendarRange = useMemo(() => {
    return getCalendarRange(calendarConfig);
  }, [calendarConfig]);
  const initialSelectedDate = useMemo(() => getInitialSelectedDate(calendarRange), [calendarRange]);
  const initialSelectedMonthKey = useMemo(() => {
    return extractMonthKey(initialSelectedDate);
  }, [initialSelectedDate]);
  const weekdayLabels = useMemo(() => WEEKDAY_LABELS[language], [language]);
  const scrollViewRef = useRef<ScrollView>(null);
  const didInitialScrollRef = useRef(false);
  const monthOffsetsRef = useRef<Record<string, number>>({});
  const pendingMonthKeyRef = useRef<string | null>(initialSelectedMonthKey);
  const [didLoad, setDidLoad] = useState(false);
  const [schedules, setSchedules] = useState<ScheduleSummary[]>([]);
  const [selectedDate, setSelectedDate] = useState(initialSelectedDate);

  const schedulesByDate = useMemo(() => groupSchedulesByDate(schedules), [schedules]);

  useEffect(() => {
    if (didLoad) {
      return;
    }

    setDidLoad(true);

    const loadCalendar = async () => {
      try {
        const schedulesData = await listSchedules(authorizedRequest, calendarRange);
        setSchedules(schedulesData.items);
      } catch {
        setSchedules([]);
      }
    };

    loadCalendar().catch(() => undefined);
  }, [authorizedRequest, calendarRange, didLoad]);

  useEffect(() => {
    const nextDate = getInitialSelectedDate(calendarRange);
    const nextMonthKey = extractMonthKey(nextDate);

    setSelectedDate(nextDate);

    const targetOffset = monthOffsetsRef.current[nextMonthKey];

    if (typeof targetOffset === 'number') {
      pendingMonthKeyRef.current = null;
      scrollViewRef.current?.scrollTo({
        y: Math.max(targetOffset - MONTH_SCROLL_TOP_GAP, 0),
        animated: false,
      });
      return;
    }

    pendingMonthKeyRef.current = nextMonthKey;
  }, [calendarRange, focusRequestKey]);

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        {
          paddingBottom: bottomInset,
        },
      ]}
      ref={scrollViewRef}
      showsVerticalScrollIndicator={false}>
      {calendarMonths.map(month => (
        <View
          key={month.key}
          onLayout={event => {
            monthOffsetsRef.current[month.key] = event.nativeEvent.layout.y;

              if (month.key === initialSelectedMonthKey && !didInitialScrollRef.current) {
                didInitialScrollRef.current = true;
                pendingMonthKeyRef.current = null;
                scrollViewRef.current?.scrollTo({
                  y: Math.max(event.nativeEvent.layout.y - MONTH_SCROLL_TOP_GAP, 0),
                  animated: false,
                });
                return;
            }

              if (month.key === pendingMonthKeyRef.current) {
                pendingMonthKeyRef.current = null;
                scrollViewRef.current?.scrollTo({
                  y: Math.max(event.nativeEvent.layout.y - MONTH_SCROLL_TOP_GAP, 0),
                  animated: false,
                });
              }
          }}
          style={styles.monthSection}>
          <Text style={styles.monthTitle}>{month.label}</Text>

          <View style={styles.weekdayRow}>
            {weekdayLabels.map((label, index) => (
              <Text
                key={`${month.key}-${label}`}
                style={[
                  styles.weekdayLabel,
                  index === 0 ? styles.weekdayLabelSunday : null,
                ]}>
                {label}
              </Text>
            ))}
          </View>

          {month.weeks.map((week, weekIndex) => (
            <View key={`${month.key}-${weekIndex}`} style={styles.weekRow}>
              {week.map(day => {
                const entryCount = schedulesByDate[day.dateKey]?.length ?? 0;
                const isSelected = day.dateKey === selectedDate;

                return (
                  <Pressable
                    accessibilityHint={
                      entryCount > 0
                        ? t('calendar_entries_count', { count: entryCount })
                        : undefined
                    }
                    accessibilityState={{ selected: isSelected }}
                    key={day.dateKey}
                    disabled={!day.inCurrentMonth}
                    onPress={() => {
                      setSelectedDate(day.dateKey);
                    }}
                    style={styles.dayCell}>
                    <View
                      style={[
                        styles.dayNumberWrap,
                      ]}>
                      <Text
                        style={[
                          styles.dayNumber,
                          day.isSunday ? styles.dayNumberSunday : null,
                          day.isSaturday ? styles.dayNumberSaturday : null,
                          !day.inCurrentMonth ? styles.dayNumberMuted : null,
                        ]}>
                          {day.dayNumber}
                        </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

function getCalendarConfig(): CalendarConfig {
  return {
    monthCount: getMonthSpan(
      CALENDAR_START_YEAR,
      CALENDAR_START_MONTH_INDEX,
      CALENDAR_END_YEAR,
      CALENDAR_END_MONTH_INDEX,
    ),
    startMonthIndex: CALENDAR_START_MONTH_INDEX,
    startYear: CALENDAR_START_YEAR,
  };
}

function getMonthSpan(
  startYear: number,
  startMonthIndex: number,
  endYear: number,
  endMonthIndex: number,
): number {
  return (endYear - startYear) * 12 + (endMonthIndex - startMonthIndex) + 1;
}

function buildCalendarMonths(
  config: CalendarConfig,
  language: Language,
): CalendarMonth[] {
  return Array.from({ length: config.monthCount }, (_monthItem, monthOffset) => {
    const monthDate = new Date(
      config.startYear,
      config.startMonthIndex + monthOffset,
      1,
    );
    const year = monthDate.getFullYear();
    const monthIndex = monthDate.getMonth();
    const firstDay = new Date(year, monthIndex, 1);
    const firstWeekday = firstDay.getDay();
    const firstVisibleDay = new Date(year, monthIndex, 1 - firstWeekday);
    const weeks = Array.from({ length: 6 }, (_weekItem, weekIndex) => {
      return Array.from({ length: 7 }, (_dayItem, weekdayIndex) => {
        const date = new Date(firstVisibleDay);
        date.setDate(firstVisibleDay.getDate() + weekIndex * 7 + weekdayIndex);

        return {
          dateKey: formatDate(date),
          dayNumber: date.getDate(),
          inCurrentMonth: date.getMonth() === firstDay.getMonth(),
          isSaturday: date.getDay() === 6,
          isSunday: date.getDay() === 0,
        };
      });
    });

    return {
      key: `${year}-${pad(monthIndex + 1)}`,
      label: formatMonthLabel(year, monthIndex, language),
      weeks,
    };
  });
}

function getCalendarRange(config: CalendarConfig) {
  const start = new Date(config.startYear, config.startMonthIndex, 1);
  const end = new Date(
    config.startYear,
    config.startMonthIndex + config.monthCount,
    0,
  );

  return {
    from: formatDate(start),
    to: formatDate(end),
  };
}

function getInitialSelectedDate(range: { from: string; to: string }): string {
  const todayKey = formatDate(new Date());

  if (todayKey < range.from) {
    return range.from;
  }

  if (todayKey > range.to) {
    return range.to;
  }

  return todayKey;
}

function groupSchedulesByDate(
  schedules: ScheduleSummary[],
): Record<string, ScheduleSummary[]> {
  return schedules.reduce<Record<string, ScheduleSummary[]>>((result, schedule) => {
    const dateKey = extractDateKey(schedule.scheduledAt);

    if (!result[dateKey]) {
      result[dateKey] = [];
    }

    result[dateKey].push(schedule);

    return result;
  }, {});
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}`;
}

function extractDateKey(isoString: string): string {
  return formatDate(new Date(isoString));
}

function extractMonthKey(dateKey: string): string {
  return dateKey.slice(0, 7);
}

function formatMonthLabel(
  year: number,
  monthIndex: number,
  language: Language,
): string {
  if (language === 'ko') {
    return `${year}년 ${monthIndex + 1}월`;
  }

  if (language === 'ja') {
    return `${year}年 ${monthIndex + 1}月`;
  }

  return `${ENGLISH_MONTH_LABELS[monthIndex]} ${year}`;
}

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

const styles = StyleSheet.create({
  container: {
    gap: 18,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  monthSection: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.divider,
    borderRadius: 18,
    borderWidth: 1,
    gap: 18,
    paddingHorizontal: 16,
    paddingBottom: 20,
    paddingTop: 18,
  },
  monthTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 28,
  },
  weekdayRow: {
    flexDirection: 'row',
    gap: 4,
  },
  weekdayLabel: {
    color: colors.textSecondary,
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  weekdayLabelSunday: {
    color: colors.danger,
  },
  weekRow: {
    flexDirection: 'row',
    gap: 4,
  },
  dayCell: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 66,
  },
  dayNumberWrap: {
    alignItems: 'center',
    borderRadius: 999,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  dayNumber: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '500',
    letterSpacing: -0.3,
  },
  dayNumberMuted: {
    color: colors.divider,
  },
  dayNumberSunday: {
    color: colors.danger,
  },
  dayNumberSaturday: {
    color: colors.textPrimary,
  },
});
