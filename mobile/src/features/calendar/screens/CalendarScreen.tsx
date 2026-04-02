import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useLanguage } from '../../../shared/i18n/LanguageContext';
import type { Language } from '../../../shared/i18n/messages';
import { colors } from '../../../shared/theme/colors';
import { journalTokens } from '../../../shared/theme/journalTokens';
import { useAuth } from '../../auth/context/AuthContext';
import { listPlaces } from '../../places/api/placesApi';
import type { SavedPlace } from '../../places/types';
import {
  createSchedule,
  deleteSchedule,
  getSchedule,
  listSchedules,
  updateSchedule,
} from '../api/schedulesApi';
import type { ScheduleDetail, ScheduleSummary } from '../types';

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

type ScheduleEditorDraft = {
  id: string | null;
  memo: string;
  mode: 'create' | 'edit';
  placeId: string | null;
  scheduledAtInput: string;
  title: string;
  visitStatus: ScheduleDetail['visitStatus'];
};

type CalendarViewMode = 'month' | 'day';

const CALENDAR_START_YEAR = 2026;
const CALENDAR_START_MONTH_INDEX = 0;
const CALENDAR_END_YEAR = 2028;
const CALENDAR_END_MONTH_INDEX = 11;
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
  dataRefreshKey: number;
  focusRequestKey: number;
  requestedDateKey: string | null;
};

export function CalendarScreen({
  bottomInset,
  dataRefreshKey,
  focusRequestKey,
  requestedDateKey,
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
  const initialSelectedDate = useMemo(
    () => getInitialSelectedDate(calendarRange),
    [calendarRange],
  );
  const weekdayLabels = useMemo(() => WEEKDAY_LABELS[language], [language]);
  const [isLoading, setIsLoading] = useState(false);
  const [schedules, setSchedules] = useState<ScheduleSummary[]>([]);
  const [selectedDate, setSelectedDate] = useState(initialSelectedDate);
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [editorDraft, setEditorDraft] = useState<ScheduleEditorDraft | null>(
    null,
  );
  const [isEditorLoading, setIsEditorLoading] = useState(false);
  const [isEditorSaving, setIsEditorSaving] = useState(false);
  const [isEditorDeleting, setIsEditorDeleting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const schedulesByDate = useMemo(
    () => groupSchedulesByDate(schedules),
    [schedules],
  );
  const selectedSchedules = useMemo(() => {
    return schedulesByDate[selectedDate] ?? [];
  }, [schedulesByDate, selectedDate]);
  const savedPlacesById = useMemo(() => {
    return savedPlaces.reduce<Record<string, SavedPlace>>((result, place) => {
      result[place.id] = place;
      return result;
    }, {});
  }, [savedPlaces]);

  const refreshSchedules = useCallback(
    async (isMounted?: () => boolean) => {
      setIsLoading(true);

      try {
        const schedulesData = await listSchedules(
          authorizedRequest,
          calendarRange,
        );

        if (!isMounted || isMounted()) {
          setSchedules(schedulesData.items);
        }
      } catch {
        if (!isMounted || isMounted()) {
          setSchedules([]);
        }
      } finally {
        if (!isMounted || isMounted()) {
          setIsLoading(false);
        }
      }
    },
    [authorizedRequest, calendarRange],
  );

  const refreshSavedPlaces = useCallback(
    async (isMounted?: () => boolean) => {
      try {
        const placesData = await listPlaces(authorizedRequest);

        if (!isMounted || isMounted()) {
          setSavedPlaces(placesData.items);
        }
      } catch {
        if (!isMounted || isMounted()) {
          setSavedPlaces([]);
        }
      }
    },
    [authorizedRequest],
  );

  useEffect(() => {
    let isMounted = true;
    const checkMounted = () => isMounted;

    Promise.all([
      refreshSchedules(checkMounted),
      refreshSavedPlaces(checkMounted),
    ]).catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [dataRefreshKey, refreshSavedPlaces, refreshSchedules]);

  useEffect(() => {
    const nextDate = getInitialSelectedDate(calendarRange, requestedDateKey);

    setSelectedDate(nextDate);
    setViewMode('month');
  }, [calendarRange, focusRequestKey, requestedDateKey]);

  useEffect(() => {
    if (!editorDraft || editorDraft.mode !== 'edit' || !editorDraft.id) {
      return;
    }

    const scheduleStillVisible = selectedSchedules.some(schedule => {
      return schedule.id === editorDraft.id;
    });

    if (!scheduleStillVisible) {
      setEditorDraft(null);
    }
  }, [editorDraft, selectedSchedules]);

  const handleOpenEditor = async (scheduleId: string) => {
    setIsEditorLoading(true);
    setFeedback(null);

    try {
      const [schedule, placesData] = await Promise.all([
        getSchedule(authorizedRequest, scheduleId),
        listPlaces(authorizedRequest),
      ]);

      setSavedPlaces(placesData.items);
      setEditorDraft({
        id: schedule.id,
        memo: schedule.memo ?? '',
        mode: 'edit',
        placeId: schedule.placeId,
        scheduledAtInput: formatDateTimeInput(schedule.scheduledAt),
        title: schedule.title,
        visitStatus: schedule.visitStatus,
      });
    } catch (caughtError) {
      setFeedback(extractErrorMessage(caughtError));
    } finally {
      setIsEditorLoading(false);
    }
  };

  const handleOpenCreateDraft = async () => {
    setIsEditorLoading(true);
    setFeedback(null);

    try {
      const placesData =
        savedPlaces.length > 0
          ? { items: savedPlaces }
          : await listPlaces(authorizedRequest);

      setSavedPlaces(placesData.items);
      setEditorDraft({
        id: null,
        memo: '',
        mode: 'create',
        placeId: null,
        scheduledAtInput: buildSelectedDateDraft(selectedDate),
        title: '',
        visitStatus: 'planned',
      });
    } catch (caughtError) {
      setFeedback(extractErrorMessage(caughtError));
    } finally {
      setIsEditorLoading(false);
    }
  };

  const handleSaveEditor = async () => {
    if (!editorDraft) {
      return;
    }

    const normalizedTitle = editorDraft.title.trim();

    if (!normalizedTitle) {
      setFeedback(t('calendar_title_required'));
      return;
    }

    const scheduledAt = parseDateTimeInput(editorDraft.scheduledAtInput);

    if (!scheduledAt) {
      setFeedback(t('calendar_date_format_error'));
      return;
    }

    setIsEditorSaving(true);
    setFeedback(null);

    try {
      if (editorDraft.mode === 'create') {
        await createSchedule(authorizedRequest, {
          title: normalizedTitle,
          scheduledAt,
          memo: normalizeMemo(editorDraft.memo),
          placeId: editorDraft.placeId,
        });
      } else if (editorDraft.id) {
        await updateSchedule(authorizedRequest, {
          id: editorDraft.id,
          memo: normalizeMemo(editorDraft.memo),
          placeId: editorDraft.placeId,
          scheduledAt,
          title: normalizedTitle,
          visitStatus: editorDraft.visitStatus,
        });
      }

      const nextDateKey = extractDateKey(scheduledAt);

      setSelectedDate(nextDateKey);
      setEditorDraft(null);
      await refreshSchedules();
      setFeedback(
        t(
          editorDraft.mode === 'create'
            ? 'calendar_schedule_created'
            : 'calendar_schedule_updated',
        ),
      );
    } catch (caughtError) {
      setFeedback(extractErrorMessage(caughtError));
    } finally {
      setIsEditorSaving(false);
    }
  };

  const handleDeleteEditor = async () => {
    if (!editorDraft || editorDraft.mode !== 'edit' || !editorDraft.id) {
      return;
    }

    setIsEditorDeleting(true);
    setFeedback(null);

    try {
      await deleteSchedule(authorizedRequest, editorDraft.id);
      setEditorDraft(null);
      await refreshSchedules();
      setFeedback(t('calendar_schedule_deleted'));
    } catch (caughtError) {
      setFeedback(extractErrorMessage(caughtError));
    } finally {
      setIsEditorDeleting(false);
    }
  };

  const handleOpenDayDetail = (dateKey: string) => {
    setSelectedDate(dateKey);
    setViewMode('day');
  };

  const handleReturnToMonth = () => {
    setViewMode('month');
  };

  const editorSection = editorDraft ? (
    <View style={styles.editorSection}>
      <View style={styles.editorHeader}>
        <Text style={styles.editorMetaPreview}>
          {editorDraft.scheduledAtInput}
        </Text>
      </View>

      <TextInput
        onChangeText={nextValue => {
          setEditorDraft(currentDraft => {
            if (!currentDraft) {
              return currentDraft;
            }

            return {
              ...currentDraft,
              title: nextValue,
            };
          });
        }}
        placeholder={t('calendar_title_placeholder')}
        placeholderTextColor={colors.textMuted}
        style={styles.entryTitleInput}
        value={editorDraft.title}
      />

      <View style={styles.fieldBlock}>
        <Text style={styles.fieldLabel}>{t('calendar_date_time')}</Text>
        <TextInput
          autoCapitalize="none"
          onChangeText={nextValue => {
            setEditorDraft(currentDraft => {
              if (!currentDraft) {
                return currentDraft;
              }

              return {
                ...currentDraft,
                scheduledAtInput: nextValue,
              };
            });
          }}
          placeholder={t('calendar_invalid_meta')}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={editorDraft.scheduledAtInput}
        />
      </View>

      <View style={styles.fieldBlock}>
        <Text style={styles.fieldLabel}>{t('calendar_linked_place')}</Text>
        <View style={styles.optionRow}>
          <Pressable
            onPress={() => {
              setEditorDraft(currentDraft => {
                if (!currentDraft) {
                  return currentDraft;
                }

                return {
                  ...currentDraft,
                  placeId: null,
                };
              });
            }}
            style={[
              styles.optionChip,
              editorDraft.placeId === null ? styles.optionChipActive : null,
            ]}
            testID="calendar-place-option-none"
          >
            <Text
              style={[
                styles.optionChipLabel,
                editorDraft.placeId === null
                  ? styles.optionChipLabelActive
                  : null,
              ]}
            >
              {t('calendar_no_place')}
            </Text>
          </Pressable>

          {savedPlaces.map(place => {
            const isActive = editorDraft.placeId === place.id;

            return (
              <Pressable
                key={place.id}
                onPress={() => {
                  setEditorDraft(currentDraft => {
                    if (!currentDraft) {
                      return currentDraft;
                    }

                    return {
                      ...currentDraft,
                      placeId: place.id,
                    };
                  });
                }}
                style={[
                  styles.optionChip,
                  isActive ? styles.optionChipActive : null,
                ]}
                testID={`calendar-place-option-${place.id}`}
              >
                <Text
                  style={[
                    styles.optionChipLabel,
                    isActive ? styles.optionChipLabelActive : null,
                  ]}
                >
                  {place.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.fieldBlock}>
        <Text style={styles.fieldLabel}>{t('calendar_visit_status')}</Text>
        <View style={styles.optionRow}>
          {(['planned', 'visited', 'skipped'] as const).map(status => {
            const isActive = editorDraft.visitStatus === status;

            return (
              <Pressable
                key={status}
                onPress={() => {
                  setEditorDraft(currentDraft => {
                    if (!currentDraft) {
                      return currentDraft;
                    }

                    return {
                      ...currentDraft,
                      visitStatus: status,
                    };
                  });
                }}
                style={[
                  styles.optionChip,
                  isActive ? styles.optionChipActive : null,
                ]}
              >
                <Text
                  style={[
                    styles.optionChipLabel,
                    isActive ? styles.optionChipLabelActive : null,
                  ]}
                >
                  {t(getVisitStatusLabel(status))}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.fieldBlock}>
        <Text style={styles.fieldLabel}>{t('calendar_entry_detail')}</Text>
        <TextInput
          multiline
          onChangeText={nextValue => {
            setEditorDraft(currentDraft => {
              if (!currentDraft) {
                return currentDraft;
              }

              return {
                ...currentDraft,
                memo: nextValue,
              };
            });
          }}
          placeholder={t('calendar_body_placeholder')}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, styles.memoInput]}
          value={editorDraft.memo}
        />
      </View>

      <View style={styles.editorActions}>
        {editorDraft.mode === 'edit' ? (
          <Pressable
            disabled={isEditorDeleting || isEditorSaving}
            onPress={() => {
              handleDeleteEditor().catch(() => undefined);
            }}
            style={styles.deleteButton}
            testID="calendar-delete-button"
          >
            {isEditorDeleting ? (
              <ActivityIndicator color={colors.textSecondary} size="small" />
            ) : (
              <Text style={styles.deleteButtonLabel}>
                {t('calendar_delete')}
              </Text>
            )}
          </Pressable>
        ) : (
          <Pressable
            disabled={isEditorSaving}
            onPress={() => setEditorDraft(null)}
            style={styles.cancelButton}
            testID="calendar-cancel-button"
          >
            <Text style={styles.cancelButtonLabel}>
              {t('discover_plan_cancel')}
            </Text>
          </Pressable>
        )}

        <Pressable
          disabled={isEditorDeleting || isEditorSaving}
          onPress={() => {
            handleSaveEditor().catch(() => undefined);
          }}
          style={styles.saveButton}
          testID="calendar-save-button"
        >
          {isEditorSaving ? (
            <ActivityIndicator color={colors.surfaceElevated} size="small" />
          ) : (
            <Text style={styles.saveButtonLabel}>
              {t(
                editorDraft.mode === 'create'
                  ? 'calendar_create_entry'
                  : 'calendar_save_changes',
              )}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  ) : null;

  const agendaSection = (
    <View style={styles.agendaSection}>
      <View style={styles.agendaHeader}>
        <View style={styles.agendaHeaderCopy}>
          <Text style={styles.agendaTitle}>
            {formatSelectedDateLabel(selectedDate, language)}
          </Text>
          <Text style={styles.agendaMeta}>
            {t('calendar_entries_count', { count: selectedSchedules.length })}
          </Text>
        </View>
        <Pressable
          onPress={() => {
            handleOpenCreateDraft().catch(() => undefined);
          }}
          style={styles.newButton}
          testID="calendar-new-button"
        >
          <Text style={styles.newButtonLabel}>{t('calendar_new')}</Text>
        </Pressable>
      </View>

      {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}

      {viewMode === 'day' ? editorSection : null}

      {isLoading ? (
        <View style={styles.loadingBlock}>
          <ActivityIndicator color={colors.textSecondary} size="small" />
        </View>
      ) : selectedSchedules.length === 0 ? (
        <Text style={styles.emptyText}>{t('calendar_empty')}</Text>
      ) : (
        <View style={styles.agendaList}>
          {selectedSchedules.map(schedule => (
            <Pressable
              key={schedule.id}
              onPress={() => {
                handleOpenEditor(schedule.id).catch(() => undefined);
              }}
              style={styles.agendaCard}
              testID={`calendar-agenda-${schedule.id}`}
            >
              <View style={styles.agendaCardCopy}>
                <Text style={styles.agendaCardTitle}>{schedule.title}</Text>
                <Text style={styles.agendaCardMeta}>
                  {schedule.placeId
                    ? savedPlacesById[schedule.placeId]?.name ??
                      t('calendar_linked_place')
                    : t('calendar_no_linked_place')}
                </Text>
              </View>
              <View style={styles.agendaCardAside}>
                <Text style={styles.agendaCardTime}>
                  {formatTimeLabel(schedule.scheduledAt)}
                </Text>
                <Text style={styles.agendaCardStatus}>
                  {t(getVisitStatusLabel(schedule.visitStatus))}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      {isEditorLoading ? (
        <View style={styles.loadingBlock}>
          <ActivityIndicator color={colors.textSecondary} size="small" />
        </View>
      ) : null}

      {viewMode === 'month' ? editorSection : null}
    </View>
  );

  if (viewMode === 'day') {
    return (
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingBottom: bottomInset,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.dayDetailIntro} testID="calendar-day-detail-screen">
          <Pressable
            onPress={handleReturnToMonth}
            style={styles.backButton}
            testID="calendar-day-detail-back-button"
          >
            <Text style={styles.backButtonSymbol}>{'<'}</Text>
            <Text style={styles.backButtonLabel}>
              {t('calendar_day_detail_back')}
            </Text>
          </Pressable>
          <Text style={styles.dayDetailTitle}>
            {formatSelectedDateLabel(selectedDate, language)}
          </Text>
          <Text style={styles.dayDetailMeta}>
            {t('calendar_entries_count', { count: selectedSchedules.length })}
          </Text>
        </View>

        {agendaSection}
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        {
          paddingBottom: bottomInset,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.screenIntro}>
        <Text style={styles.screenTitle}>{t('screen_calendar')}</Text>
      </View>

      {agendaSection}

      <View style={styles.monthsSection}>
        {calendarMonths.map((month, monthIndex) => (
          <View
            key={month.key}
            style={[
              styles.monthSection,
              monthIndex === 0 ? styles.monthSectionFirst : null,
            ]}
          >
            <Text style={styles.monthTitle}>{month.label}</Text>

            <View style={styles.weekdayRow}>
              {weekdayLabels.map((label, index) => (
                <Text
                  key={`${month.key}-${label}`}
                  style={[
                    styles.weekdayLabel,
                    index === 0 ? styles.weekdayLabelSunday : null,
                  ]}
                >
                  {label}
                </Text>
              ))}
            </View>

            {month.weeks.map((week, weekIndex) => (
              <View key={`${month.key}-${weekIndex}`} style={styles.weekRow}>
                {week.map(day => {
                  const daySchedules = schedulesByDate[day.dateKey] ?? [];
                  const entryCount = daySchedules.length;
                  const isSelected = day.dateKey === selectedDate;
                  const previewLabel = day.inCurrentMonth
                    ? getDayPreviewLabel(daySchedules)
                    : null;

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
                        handleOpenDayDetail(day.dateKey);
                      }}
                      style={styles.dayCell}
                      testID={`calendar-day-${day.dateKey}`}
                    >
                      <View
                        style={[
                          styles.dayNumberWrap,
                          isSelected ? styles.dayNumberWrapSelected : null,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayNumber,
                            day.isSunday ? styles.dayNumberSunday : null,
                            day.isSaturday ? styles.dayNumberSaturday : null,
                            !day.inCurrentMonth ? styles.dayNumberMuted : null,
                            isSelected ? styles.dayNumberSelected : null,
                          ]}
                        >
                          {day.dayNumber}
                        </Text>
                      </View>
                      {entryCount > 0 && day.inCurrentMonth ? (
                        previewLabel ? (
                          <View
                            style={[
                              styles.dayPreviewChip,
                              isSelected ? styles.dayPreviewChipSelected : null,
                            ]}
                          >
                            <Text
                              numberOfLines={1}
                              style={[
                                styles.dayPreviewText,
                                isSelected
                                  ? styles.dayPreviewTextSelected
                                  : null,
                              ]}
                              testID={`calendar-day-preview-${day.dateKey}`}
                            >
                              {previewLabel}
                            </Text>
                          </View>
                        ) : (
                          <View
                            style={[
                              styles.entryDot,
                              isSelected ? styles.entryDotSelected : null,
                            ]}
                          />
                        )
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        ))}
      </View>
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
  return Array.from(
    { length: config.monthCount },
    (_monthItem, monthOffset) => {
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
          date.setDate(
            firstVisibleDay.getDate() + weekIndex * 7 + weekdayIndex,
          );

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
    },
  );
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

function getInitialSelectedDate(
  range: { from: string; to: string },
  requestedDateKey?: string | null,
): string {
  if (requestedDateKey) {
    if (requestedDateKey < range.from) {
      return range.from;
    }

    if (requestedDateKey > range.to) {
      return range.to;
    }

    return requestedDateKey;
  }

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
  return schedules.reduce<Record<string, ScheduleSummary[]>>(
    (result, schedule) => {
      const dateKey = extractDateKey(schedule.scheduledAt);

      if (!result[dateKey]) {
        result[dateKey] = [];
      }

      result[dateKey].push(schedule);

      return result;
    },
    {},
  );
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}`;
}

function extractDateKey(isoString: string): string {
  return formatDate(new Date(isoString));
}

function formatSelectedDateLabel(dateKey: string, language: Language): string {
  const date = new Date(`${dateKey}T00:00:00`);

  if (language === 'ko') {
    return `${date.getFullYear()}년 ${
      date.getMonth() + 1
    }월 ${date.getDate()}일`;
  }

  if (language === 'ja') {
    return `${date.getFullYear()}年 ${
      date.getMonth() + 1
    }月 ${date.getDate()}日`;
  }

  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatTimeLabel(isoString: string): string {
  const date = new Date(isoString);

  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getVisitStatusLabel(
  visitStatus: ScheduleSummary['visitStatus'],
):
  | 'calendar_status_planned'
  | 'calendar_status_visited'
  | 'calendar_status_skipped' {
  switch (visitStatus) {
    case 'planned':
      return 'calendar_status_planned';
    case 'visited':
      return 'calendar_status_visited';
    case 'skipped':
      return 'calendar_status_skipped';
  }
}

function getDayPreviewLabel(schedules: ScheduleSummary[]): string | null {
  const firstSchedule = schedules[0];

  if (!firstSchedule) {
    return null;
  }

  const trimmedTitle = firstSchedule.title.trim();
  const baseLabel =
    trimmedTitle.length > 12 ? `${trimmedTitle.slice(0, 11)}…` : trimmedTitle;

  if (schedules.length === 1) {
    return baseLabel;
  }

  return `${baseLabel} +${schedules.length - 1}`;
}

function formatDateTimeInput(isoString: string): string {
  const date = new Date(isoString);

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function buildSelectedDateDraft(dateKey: string): string {
  return `${dateKey} 12:00`;
}

function parseDateTimeInput(value: string): string | null {
  const trimmedValue = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(trimmedValue);

  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute] = match;
  const parsedDate = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    0,
    0,
  );

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate.toISOString();
}

function normalizeMemo(value: string): string | null {
  const trimmedValue = value.trim();

  return trimmedValue ? trimmedValue : null;
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'unexpected error';
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
    backgroundColor: journalTokens.color.pageBackground,
    gap: journalTokens.spacing.sectionGap,
    paddingHorizontal: journalTokens.spacing.screenHorizontal,
    paddingTop: journalTokens.spacing.screenTop,
  },
  screenIntro: {
    gap: 6,
    paddingTop: 4,
  },
  screenTitle: {
    color: journalTokens.color.textStrong,
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: -0.6,
    lineHeight: 30,
  },
  monthsSection: {
    gap: 18,
  },
  monthSection: {
    borderTopColor: journalTokens.color.rule,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 16,
    paddingTop: 18,
  },
  monthSectionFirst: {
    borderTopWidth: 0,
    paddingTop: 0,
  },
  monthTitle: {
    color: journalTokens.color.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  weekdayRow: {
    flexDirection: 'row',
    gap: 4,
    paddingBottom: 4,
  },
  weekdayLabel: {
    color: journalTokens.color.textMuted,
    flex: 1,
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  weekdayLabelSunday: {
    color: journalTokens.color.textMuted,
  },
  weekRow: {
    flexDirection: 'row',
    gap: 4,
  },
  dayCell: {
    alignItems: 'center',
    flex: 1,
    gap: 6,
    justifyContent: 'flex-start',
    minHeight: 74,
    paddingVertical: 8,
  },
  dayNumberWrap: {
    alignItems: 'center',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 32,
    minWidth: 32,
    paddingHorizontal: 10,
  },
  dayNumberWrapSelected: {
    backgroundColor: journalTokens.color.accentSoft,
    borderColor: journalTokens.color.ruleStrong,
    borderWidth: 1,
  },
  dayNumber: {
    color: journalTokens.color.textPrimary,
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: -0.3,
  },
  dayNumberSelected: {
    color: journalTokens.color.textStrong,
  },
  dayNumberMuted: {
    color: '#CEC8BE',
  },
  dayNumberSunday: {
    color: journalTokens.color.textSecondary,
  },
  dayNumberSaturday: {
    color: journalTokens.color.textPrimary,
  },
  entryDot: {
    backgroundColor: journalTokens.color.textMuted,
    borderRadius: 999,
    height: 4,
    marginTop: 4,
    width: 4,
  },
  entryDotSelected: {
    backgroundColor: journalTokens.color.accent,
  },
  dayPreviewChip: {
    borderRadius: 8,
    minHeight: 22,
    paddingHorizontal: 3,
    paddingVertical: 2,
    width: '100%',
  },
  dayPreviewChipSelected: {
    backgroundColor: journalTokens.color.accentSoft,
  },
  dayPreviewText: {
    color: journalTokens.color.textMuted,
    fontSize: 10,
    lineHeight: 13,
    textAlign: 'center',
  },
  dayPreviewTextSelected: {
    color: journalTokens.color.textSecondary,
  },
  agendaSection: {
    gap: 16,
  },
  dayDetailIntro: {
    gap: 6,
    paddingTop: 2,
  },
  backButton: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    minHeight: 36,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  backButtonSymbol: {
    color: journalTokens.color.textSecondary,
    fontSize: 14,
    lineHeight: 14,
  },
  backButtonLabel: {
    color: journalTokens.color.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  dayDetailTitle: {
    color: journalTokens.color.textStrong,
    fontSize: 26,
    fontWeight: '600',
    letterSpacing: -0.8,
    lineHeight: 32,
  },
  dayDetailMeta: {
    color: journalTokens.color.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  agendaHeader: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  agendaHeaderCopy: {
    flex: 1,
    gap: 6,
  },
  agendaTitle: {
    color: journalTokens.color.textStrong,
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.4,
    lineHeight: 28,
  },
  agendaMeta: {
    color: journalTokens.color.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  newButton: {
    alignItems: 'center',
    backgroundColor: journalTokens.color.pageSurface,
    borderColor: journalTokens.color.ruleStrong,
    borderRadius: journalTokens.radius.round,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: 14,
  },
  newButtonLabel: {
    color: journalTokens.color.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  feedback: {
    color: journalTokens.color.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  loadingBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  emptyText: {
    color: journalTokens.color.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    paddingVertical: 10,
  },
  agendaList: {
    borderTopColor: journalTokens.color.rule,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  agendaCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    borderBottomColor: journalTokens.color.rule,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: journalTokens.spacing.listRowVertical,
  },
  agendaCardCopy: {
    flex: 1,
    gap: 8,
  },
  agendaCardAside: {
    alignItems: 'flex-end',
    gap: 6,
    minWidth: 64,
    paddingTop: 2,
  },
  agendaCardTime: {
    color: journalTokens.color.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  agendaCardStatus: {
    color: journalTokens.color.textMuted,
    fontSize: 11,
    lineHeight: 14,
  },
  agendaCardTitle: {
    color: journalTokens.color.textPrimary,
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  agendaCardMeta: {
    color: journalTokens.color.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  editorSection: {
    borderTopColor: journalTokens.color.rule,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 16,
    paddingTop: 18,
  },
  editorHeader: {
    gap: 0,
  },
  editorMetaPreview: {
    color: journalTokens.color.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  entryTitleInput: {
    color: journalTokens.color.textStrong,
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: -0.6,
    lineHeight: 30,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  fieldBlock: {
    gap: 8,
  },
  fieldLabel: {
    color: journalTokens.color.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: 'transparent',
    borderBottomColor: journalTokens.color.rule,
    borderBottomWidth: StyleSheet.hairlineWidth,
    color: journalTokens.color.textPrimary,
    fontSize: 15,
    lineHeight: 20,
    paddingHorizontal: 0,
    paddingBottom: 10,
    paddingTop: 6,
  },
  memoInput: {
    borderBottomWidth: 0,
    fontSize: 16,
    lineHeight: 30,
    minHeight: 180,
    paddingBottom: 0,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    backgroundColor: journalTokens.color.pageSurface,
    borderColor: journalTokens.color.ruleStrong,
    borderRadius: journalTokens.radius.round,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionChipActive: {
    backgroundColor: journalTokens.color.accentSoft,
    borderColor: journalTokens.color.accent,
  },
  optionChipLabel: {
    color: journalTokens.color.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  optionChipLabelActive: {
    color: journalTokens.color.textPrimary,
  },
  editorActions: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 8,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: journalTokens.color.accent,
    borderRadius: journalTokens.radius.soft,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  saveButtonLabel: {
    color: journalTokens.color.inverseText,
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    alignItems: 'center',
    backgroundColor: journalTokens.color.pageSurface,
    borderColor: journalTokens.color.ruleStrong,
    borderRadius: journalTokens.radius.soft,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  deleteButtonLabel: {
    color: journalTokens.color.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  cancelButton: {
    alignItems: 'center',
    backgroundColor: journalTokens.color.pageSurface,
    borderColor: journalTokens.color.ruleStrong,
    borderRadius: journalTokens.radius.soft,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  cancelButtonLabel: {
    color: journalTokens.color.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
});
