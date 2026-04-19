import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
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
import type {
  ScheduleDetail,
  ScheduleRepeatFrequency,
  ScheduleReminderMinutesBefore,
  ScheduleSummary,
} from '../types';

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
  reminderMinutesBefore: ScheduleReminderMinutesBefore | null;
  repeatFrequency: ScheduleRepeatFrequency;
  scheduledAtInput: string;
  title: string;
  visitStatus: ScheduleDetail['visitStatus'];
};

type CalendarViewMode = 'month' | 'day';
type CalendarDraftRequest = {
  key: number;
  placeId: string | null;
  title: string | null;
};

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
  draftRequest?: CalendarDraftRequest | null;
  focusRequestKey: number;
  onSchedulesChanged?: () => void;
  requestedDateKey: string | null;
  requestedViewMode?: CalendarViewMode;
};

export function CalendarScreen({
  bottomInset,
  dataRefreshKey,
  draftRequest = null,
  focusRequestKey,
  onSchedulesChanged,
  requestedDateKey,
  requestedViewMode = 'month',
}: CalendarScreenProps): React.JSX.Element {
  const { authorizedRequest } = useAuth();
  const { language, t } = useLanguage();
  const handledDraftRequestKeyRef = useRef<number | null>(null);
  const monthPagerRef = useRef<ScrollView | null>(null);
  const { width: windowWidth } = useWindowDimensions();
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
  const todayKey = useMemo(() => formatDate(new Date()), []);
  const [isLoading, setIsLoading] = useState(false);
  const [schedules, setSchedules] = useState<ScheduleSummary[]>([]);
  const [selectedDate, setSelectedDate] = useState(initialSelectedDate);
  const [visibleMonthIndex, setVisibleMonthIndex] = useState(() => {
    return getMonthIndexForDateKey(calendarConfig, initialSelectedDate);
  });
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [hasExplicitDateSelection, setHasExplicitDateSelection] = useState(
    Boolean(requestedDateKey) || requestedViewMode === 'day',
  );
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
  const visibleMonth = calendarMonths[visibleMonthIndex] ?? calendarMonths[0];
  const monthPageWidth = Math.max(
    windowWidth - journalTokens.spacing.screenHorizontal * 2,
    280,
  );
  const savedPlacesById = useMemo(() => {
    return savedPlaces.reduce<Record<string, SavedPlace>>((result, place) => {
      result[place.id] = place;
      return result;
    }, {});
  }, [savedPlaces]);
  const editorDraftDate = editorDraft
    ? parseDateInputValue(extractDatePart(editorDraft.scheduledAtInput))
    : null;
  const editorDraftDateTime = editorDraft
    ? parseDateTimeValue(editorDraft.scheduledAtInput)
    : null;
  const editorDraftTimeInput = editorDraft
    ? extractTimePart(editorDraft.scheduledAtInput)
    : '';

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
    setVisibleMonthIndex(getMonthIndexForDateKey(calendarConfig, nextDate));
    setViewMode(requestedViewMode);
    setHasExplicitDateSelection(
      Boolean(requestedDateKey) || requestedViewMode === 'day',
    );
    setEditorDraft(null);
  }, [
    calendarConfig,
    calendarRange,
    focusRequestKey,
    requestedDateKey,
    requestedViewMode,
  ]);

  useEffect(() => {
    monthPagerRef.current?.scrollTo?.({
      x: visibleMonthIndex * monthPageWidth,
      animated: false,
    });
  }, [monthPageWidth, visibleMonthIndex]);

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
        reminderMinutesBefore: schedule.reminderMinutesBefore,
        repeatFrequency: 'none',
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

  const handleOpenCreateDraft = useCallback(
    async (
      options: {
        dateKey?: string;
        placeId?: string | null;
        title?: string | null;
      } = {},
    ) => {
      setIsEditorLoading(true);
      setFeedback(null);

      try {
        const placesData =
          savedPlaces.length > 0
            ? { items: savedPlaces }
            : await listPlaces(authorizedRequest);
        const requestedPlaceId =
          options.placeId &&
          placesData.items.some(place => place.id === options.placeId)
            ? options.placeId
            : null;

        setSavedPlaces(placesData.items);
        setEditorDraft({
          id: null,
          memo: '',
          mode: 'create',
          placeId: requestedPlaceId,
          reminderMinutesBefore: null,
          repeatFrequency: 'none',
          scheduledAtInput: buildSelectedDateDraft(
            options.dateKey ?? selectedDate,
          ),
          title: options.title ?? '',
          visitStatus: 'planned',
        });
      } catch (caughtError) {
        setFeedback(extractErrorMessage(caughtError));
      } finally {
        setIsEditorLoading(false);
      }
    },
    [authorizedRequest, savedPlaces, selectedDate],
  );

  useEffect(() => {
    if (!draftRequest) {
      return;
    }

    if (handledDraftRequestKeyRef.current === draftRequest.key) {
      return;
    }

    handledDraftRequestKeyRef.current = draftRequest.key;

    handleOpenCreateDraft({
      dateKey: requestedDateKey ?? selectedDate,
      placeId: draftRequest.placeId,
      title: draftRequest.title,
    }).catch(() => undefined);
  }, [
    draftRequest,
    handleOpenCreateDraft,
    requestedDateKey,
    selectedDate,
  ]);

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
        const createdSchedule = await createSchedule(authorizedRequest, {
          title: normalizedTitle,
          scheduledAt,
          memo: normalizeMemo(editorDraft.memo),
          placeId: editorDraft.placeId,
          reminderMinutesBefore: editorDraft.reminderMinutesBefore,
          repeatFrequency: editorDraft.repeatFrequency,
        });

        setFeedback(
          createdSchedule.createdCount > 1
            ? t('calendar_schedule_series_created', {
                count: createdSchedule.createdCount,
              })
            : t('calendar_schedule_created'),
        );
      } else if (editorDraft.id) {
        await updateSchedule(authorizedRequest, {
          id: editorDraft.id,
          memo: normalizeMemo(editorDraft.memo),
          placeId: editorDraft.placeId,
          reminderMinutesBefore: editorDraft.reminderMinutesBefore,
          scheduledAt,
          title: normalizedTitle,
          visitStatus: editorDraft.visitStatus,
        });

        setFeedback(t('calendar_schedule_updated'));
      }

      const nextDateKey = extractDateKey(scheduledAt);

      setSelectedDate(nextDateKey);
      setEditorDraft(null);
      await refreshSchedules();
      onSchedulesChanged?.();
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
      onSchedulesChanged?.();
      setFeedback(t('calendar_schedule_deleted'));
    } catch (caughtError) {
      setFeedback(extractErrorMessage(caughtError));
    } finally {
      setIsEditorDeleting(false);
    }
  };

  const handleSelectDate = (dateKey: string) => {
    setSelectedDate(dateKey);
    setVisibleMonthIndex(getMonthIndexForDateKey(calendarConfig, dateKey));
    setHasExplicitDateSelection(true);
    setEditorDraft(null);
    setFeedback(null);
    setViewMode('day');
  };

  const handleReturnToMonth = () => {
    setViewMode('month');
    setVisibleMonthIndex(getMonthIndexForDateKey(calendarConfig, selectedDate));
    setHasExplicitDateSelection(true);
  };

  const handleMonthPagerMomentumEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const nextIndex = Math.round(
      event.nativeEvent.contentOffset.x / monthPageWidth,
    );

    setVisibleMonthIndex(nextIndex);
    setEditorDraft(null);
    setHasExplicitDateSelection(false);
    setFeedback(null);
  };

  const updateEditorScheduledAt = (
    buildNextValue: (currentValue: string) => string | null,
  ) => {
    setEditorDraft(currentDraft => {
      if (!currentDraft) {
        return currentDraft;
      }

      const nextValue = buildNextValue(currentDraft.scheduledAtInput);

      if (!nextValue) {
        return currentDraft;
      }

      return {
        ...currentDraft,
        scheduledAtInput: nextValue,
      };
    });
  };

  const editorSection = editorDraft ? (
    <View style={styles.editorSection}>
      <View style={styles.editorHero}>
        <View style={styles.editorHeader}>
          <Text style={styles.editorEyebrow}>
            {t(
              editorDraft.mode === 'create'
                ? 'calendar_new_entry'
                : 'calendar_entry_detail',
            )}
          </Text>
          <Text style={styles.editorMetaPreview}>
            {editorDraftDateTime
              ? `${formatSelectedDateLabel(
                  formatDate(editorDraftDateTime),
                  language,
                )} · ${formatTimeLabel(editorDraftDateTime.toISOString())}`
              : editorDraft.scheduledAtInput}
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
      </View>

      <View style={styles.editorPanel}>
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>{t('calendar_date_time')}</Text>
          <View style={styles.dateTimeControlStack}>
            <View style={styles.dateSelector}>
              <Pressable
                accessibilityLabel={t('calendar_previous_day')}
                disabled={
                  !editorDraftDate ||
                  formatDate(editorDraftDate) <= calendarRange.from
                }
                onPress={() => {
                  updateEditorScheduledAt(currentValue => {
                    return shiftDateTimeInput(currentValue, calendarRange, -1);
                  });
                }}
                style={[
                  styles.stepperButton,
                  styles.stepperButtonPrev,
                  !editorDraftDate ||
                  formatDate(editorDraftDate) <= calendarRange.from
                    ? styles.stepperButtonDisabled
                    : null,
                ]}
                testID="calendar-date-prev-button"
              >
                <Text style={styles.stepperButtonLabel}>{'<'}</Text>
              </Pressable>

              <View style={styles.stepperValueBlock}>
                <Text style={styles.stepperValueTitle}>
                  {editorDraftDate
                    ? formatSelectedDateLabel(formatDate(editorDraftDate), language)
                    : editorDraft.scheduledAtInput}
                </Text>
              </View>

              <Pressable
                accessibilityLabel={t('calendar_next_day')}
                disabled={
                  !editorDraftDate ||
                  formatDate(editorDraftDate) >= calendarRange.to
                }
                onPress={() => {
                  updateEditorScheduledAt(currentValue => {
                    return shiftDateTimeInput(currentValue, calendarRange, 1);
                  });
                }}
                style={[
                  styles.stepperButton,
                  styles.stepperButtonNext,
                  !editorDraftDate ||
                  formatDate(editorDraftDate) >= calendarRange.to
                    ? styles.stepperButtonDisabled
                    : null,
                ]}
                testID="calendar-date-next-button"
              >
                <Text style={styles.stepperButtonLabel}>{'>'}</Text>
              </Pressable>
            </View>

            <View style={styles.timeInputBlock}>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={nextValue => {
                  updateEditorScheduledAt(currentValue => {
                    return replaceDateTimeInputTime(currentValue, nextValue);
                  });
                }}
                placeholder="12:00"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, styles.timeInput]}
                testID="calendar-time-input"
                value={editorDraftTimeInput}
              />
              <Text style={styles.fieldHint}>
                {t('calendar_time_adjust_hint')}
              </Text>
            </View>
          </View>
        </View>

        {editorDraft.mode === 'create' ? (
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>{t('calendar_repeat')}</Text>
            <View style={styles.optionRow}>
              {(['none', 'weekly', 'monthly'] as const).map(
                repeatFrequency => {
                  const isActive =
                    editorDraft.repeatFrequency === repeatFrequency;

                  return (
                    <Pressable
                      key={repeatFrequency}
                      onPress={() => {
                        setEditorDraft(currentDraft => {
                          if (!currentDraft) {
                            return currentDraft;
                          }

                          return {
                            ...currentDraft,
                            repeatFrequency,
                          };
                        });
                      }}
                      style={[
                        styles.optionChip,
                        isActive ? styles.optionChipActive : null,
                      ]}
                      testID={`calendar-repeat-option-${repeatFrequency}`}
                    >
                      <Text
                        style={[
                          styles.optionChipLabel,
                          isActive ? styles.optionChipLabelActive : null,
                        ]}
                      >
                        {t(getRepeatFrequencyLabel(repeatFrequency))}
                      </Text>
                    </Pressable>
                  );
                },
              )}
            </View>
            <Text style={styles.fieldHint}>{t('calendar_repeat_note')}</Text>
          </View>
        ) : null}

        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>{t('calendar_reminder')}</Text>
          <View style={styles.reminderOptionRow}>
            {([null, 0, 60, 1440] as const).map((reminderMinutesBefore, index) => {
              const reminderKey =
                reminderMinutesBefore === null
                  ? 'none'
                  : String(reminderMinutesBefore);
              const isActive =
                editorDraft.reminderMinutesBefore === reminderMinutesBefore;

              return (
                <Pressable
                  key={reminderKey}
                  onPress={() => {
                    setEditorDraft(currentDraft => {
                      if (!currentDraft) {
                        return currentDraft;
                      }

                      return {
                        ...currentDraft,
                        reminderMinutesBefore,
                      };
                    });
                  }}
                  style={[
                    styles.reminderOptionChip,
                    index > 0 ? styles.reminderOptionChipDivider : null,
                    isActive ? styles.reminderOptionChipActive : null,
                  ]}
                  testID={`calendar-reminder-option-${reminderKey}`}
                >
                  <Text
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                    numberOfLines={1}
                    style={[
                      styles.reminderOptionChipLabel,
                      isActive ? styles.reminderOptionChipLabelActive : null,
                    ]}
                  >
                    {t(getReminderMinutesBeforeLabel(reminderMinutesBefore))}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.fieldHint}>{t('calendar_reminder_note')}</Text>
        </View>
      </View>

      <View style={styles.editorPanel}>
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
      </View>

      <View style={styles.editorPanel}>
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
          accessibilityLabel={t('calendar_new')}
          onPress={() => {
            handleOpenCreateDraft().catch(() => undefined);
          }}
          style={styles.newButton}
          testID="calendar-new-button"
        >
          <Text style={styles.newButtonLabel}>+</Text>
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

      <View style={styles.monthBoard}>
        <Text style={styles.monthBoardTitle} testID="calendar-month-title">
          {visibleMonth.label}
        </Text>

        <ScrollView
          contentOffset={{ x: visibleMonthIndex * monthPageWidth, y: 0 }}
          decelerationRate="fast"
          horizontal
          onMomentumScrollEnd={handleMonthPagerMomentumEnd}
          pagingEnabled
          ref={monthPagerRef}
          showsHorizontalScrollIndicator={false}
          snapToAlignment="start"
          testID="calendar-month-pager"
        >
          {calendarMonths.map(month => (
            <View
              key={month.key}
              style={[styles.monthPage, { width: monthPageWidth }]}
              testID={`calendar-month-page-${month.key}`}
            >
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
                    const isSelected =
                      day.dateKey === selectedDate &&
                      hasExplicitDateSelection;
                    const isToday = day.dateKey === todayKey;
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
                          handleSelectDate(day.dateKey);
                        }}
                        style={styles.dayCell}
                        testID={`calendar-day-${day.dateKey}`}
                      >
                        <View
                          style={[
                            styles.dayNumberWrap,
                            isToday ? styles.dayNumberWrapToday : null,
                            isSelected ? styles.dayNumberWrapSelected : null,
                          ]}
                        >
                          <Text
                            style={[
                              styles.dayNumber,
                              day.isSunday ? styles.dayNumberSunday : null,
                              day.isSaturday ? styles.dayNumberSaturday : null,
                              !day.inCurrentMonth ? styles.dayNumberMuted : null,
                              isToday ? styles.dayNumberToday : null,
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
                                isSelected
                                  ? styles.dayPreviewChipSelected
                                  : null,
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
        </ScrollView>
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

function getMonthIndexForDateKey(
  config: CalendarConfig,
  dateKey: string,
): number {
  const parsedDate = new Date(`${dateKey}T00:00:00`);
  const monthIndex =
    (parsedDate.getFullYear() - config.startYear) * 12 +
    (parsedDate.getMonth() - config.startMonthIndex);

  if (monthIndex < 0) {
    return 0;
  }

  if (monthIndex >= config.monthCount) {
    return config.monthCount - 1;
  }

  return monthIndex;
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

function getRepeatFrequencyLabel(
  repeatFrequency: ScheduleRepeatFrequency,
):
  | 'calendar_repeat_none'
  | 'calendar_repeat_weekly'
  | 'calendar_repeat_monthly' {
  switch (repeatFrequency) {
    case 'none':
      return 'calendar_repeat_none';
    case 'weekly':
      return 'calendar_repeat_weekly';
    case 'monthly':
      return 'calendar_repeat_monthly';
  }
}

function getReminderMinutesBeforeLabel(
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

function extractDatePart(value: string): string {
  return value.trim().split(/\s+/, 2)[0] ?? '';
}

function extractTimePart(value: string): string {
  return value.trim().split(/\s+/, 2)[1] ?? '';
}

function parseDateInputValue(value: string): Date | null {
  const trimmedValue = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmedValue);

  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  const parsedDate = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    0,
    0,
    0,
    0,
  );

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate;
}

function parseDateTimeValue(value: string): Date | null {
  const datePart = extractDatePart(value);
  const timePart = extractTimePart(value);
  const parsedDate = parseDateInputValue(datePart);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timePart);

  if (!parsedDate || !timeMatch) {
    return null;
  }

  const [, hour, minute] = timeMatch;
  parsedDate.setHours(Number(hour), Number(minute), 0, 0);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate;
}

function parseDateTimeInput(value: string): string | null {
  const parsedDate = parseDateTimeValue(value);

  if (!parsedDate) {
    return null;
  }

  return parsedDate.toISOString();
}

function shiftDateTimeInput(
  value: string,
  range: { from: string; to: string },
  dayDelta: number,
): string | null {
  const parsedDate = parseDateInputValue(extractDatePart(value));
  const currentTimePart = extractTimePart(value) || '12:00';

  if (!parsedDate) {
    return null;
  }

  const nextDate = new Date(parsedDate);
  nextDate.setDate(nextDate.getDate() + dayDelta);

  return `${formatDate(clampDateToRange(nextDate, range))} ${currentTimePart}`;
}

function replaceDateTimeInputTime(value: string, nextTime: string): string {
  const currentDatePart = extractDatePart(value);

  if (!currentDatePart) {
    return nextTime;
  }

  return `${currentDatePart} ${nextTime}`;
}

function clampDateToRange(
  date: Date,
  range: { from: string; to: string },
): Date {
  if (formatDate(date) < range.from) {
    return new Date(`${range.from}T00:00:00`);
  }

  if (formatDate(date) > range.to) {
    return new Date(`${range.to}T00:00:00`);
  }

  return date;
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
  monthBoard: {
    borderTopColor: journalTokens.color.rule,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 16,
    paddingTop: 18,
  },
  monthBoardTitle: {
    color: journalTokens.color.textStrong,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.3,
    lineHeight: 24,
  },
  monthPage: {
    gap: 16,
    paddingRight: 12,
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
    backgroundColor: journalTokens.color.accent,
    borderColor: journalTokens.color.accent,
    borderWidth: 1,
  },
  dayNumberWrapToday: {
    borderColor: journalTokens.color.ruleStrong,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dayNumber: {
    color: journalTokens.color.textPrimary,
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: -0.3,
  },
  dayNumberToday: {
    color: journalTokens.color.textStrong,
  },
  dayNumberSelected: {
    color: journalTokens.color.inverseText,
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
  monthAgendaPlaceholder: {
    backgroundColor: journalTokens.color.pageSurface,
    borderColor: journalTokens.color.rule,
    borderRadius: journalTokens.radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  monthAgendaPlaceholderText: {
    color: journalTokens.color.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  dayDetailIntro: {
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
    backgroundColor: journalTokens.color.accent,
    borderRadius: journalTokens.radius.round,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  newButtonLabel: {
    color: journalTokens.color.inverseText,
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 24,
    marginTop: -2,
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
    backgroundColor: journalTokens.color.pageSurface,
    borderColor: journalTokens.color.rule,
    borderTopColor: journalTokens.color.rule,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderRadius: journalTokens.radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 14,
    marginTop: 6,
    padding: 16,
  },
  editorHero: {
    backgroundColor: journalTokens.color.accentSoft,
    borderColor: journalTokens.color.rule,
    borderRadius: journalTokens.radius.soft,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
    padding: 16,
  },
  editorHeader: {
    gap: 4,
  },
  editorEyebrow: {
    color: journalTokens.color.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  editorMetaPreview: {
    color: journalTokens.color.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  entryTitleInput: {
    color: journalTokens.color.textStrong,
    fontSize: 23,
    fontWeight: '600',
    letterSpacing: -0.6,
    lineHeight: 30,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  editorPanel: {
    backgroundColor: journalTokens.color.pageBackground,
    borderColor: journalTokens.color.rule,
    borderRadius: journalTokens.radius.soft,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 14,
    padding: 14,
  },
  fieldBlock: {
    gap: 10,
  },
  fieldLabel: {
    color: journalTokens.color.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  fieldHint: {
    color: journalTokens.color.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  input: {
    backgroundColor: journalTokens.color.pageSurface,
    borderColor: journalTokens.color.ruleStrong,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    color: journalTokens.color.textPrimary,
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dateTimeControlStack: {
    gap: 10,
  },
  dateSelector: {
    alignItems: 'center',
    backgroundColor: journalTokens.color.pageSurface,
    borderColor: journalTokens.color.ruleStrong,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: 56,
    padding: 10,
    position: 'relative',
  },
  stepperButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
    minWidth: 24,
    paddingHorizontal: 4,
    paddingVertical: 4,
    position: 'absolute',
    top: 10,
  },
  stepperButtonPrev: {
    left: 12,
  },
  stepperButtonNext: {
    right: 12,
  },
  stepperButtonDisabled: {
    opacity: 0.4,
  },
  stepperButtonLabel: {
    color: journalTokens.color.textPrimary,
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 24,
  },
  stepperValueBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  stepperValueTitle: {
    color: journalTokens.color.textStrong,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'center',
  },
  stepperValueMeta: {
    color: journalTokens.color.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  timeInputBlock: {
    gap: 8,
  },
  timeInput: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.3,
    lineHeight: 22,
    textAlign: 'center',
  },
  memoInput: {
    fontSize: 15,
    lineHeight: 24,
    minHeight: 132,
    paddingBottom: 14,
    paddingTop: 14,
    textAlignVertical: 'top',
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  reminderOptionRow: {
    backgroundColor: journalTokens.color.pageSubtle,
    borderColor: journalTokens.color.ruleStrong,
    borderRadius: journalTokens.radius.soft,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  reminderOptionChip: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
    minHeight: 46,
    paddingHorizontal: 6,
    paddingVertical: 10,
  },
  reminderOptionChipDivider: {
    borderLeftColor: journalTokens.color.rule,
    borderLeftWidth: StyleSheet.hairlineWidth,
  },
  optionChip: {
    backgroundColor: journalTokens.color.pageSurface,
    borderColor: journalTokens.color.ruleStrong,
    borderRadius: journalTokens.radius.round,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  reminderOptionChipActive: {
    backgroundColor: journalTokens.color.accent,
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
  reminderOptionChipLabel: {
    color: journalTokens.color.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  reminderOptionChipLabelActive: {
    color: journalTokens.color.inverseText,
  },
  optionChipLabelActive: {
    color: journalTokens.color.textPrimary,
  },
  editorActions: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 2,
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
