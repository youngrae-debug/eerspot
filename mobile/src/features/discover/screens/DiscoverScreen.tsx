import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type StyleProp,
  type ViewStyle,
  View,
} from 'react-native';

import { ApiError } from '../../../shared/api/http';
import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { colors } from '../../../shared/theme/colors';
import { journalTokens } from '../../../shared/theme/journalTokens';
import { useAuth } from '../../auth/context/AuthContext';
import { createSchedule } from '../../calendar/api/schedulesApi';
import { listPlaces, savePlace } from '../../places/api/placesApi';
import type { SearchPlace } from '../../places/types';
import {
  discoverPlacesFromLink,
  type LinkDiscoverItem,
  type LinkDiscoverResult,
} from '../api/discoverApi';
import type { DiscoverIncomingLinkRequest } from '../linking';

type DiscoverScreenProps = {
  incomingLinkRequest?: DiscoverIncomingLinkRequest | null;
  onIncomingLinkHandled?: (requestKey: number) => void;
  onScheduleCreated: (dateKey: string) => void;
};

type DiscoverPlanDraft = {
  memo: string;
  place: LinkDiscoverItem;
  scheduledAtInput: string;
  title: string;
};

export function DiscoverScreen({
  incomingLinkRequest = null,
  onIncomingLinkHandled,
  onScheduleCreated,
}: DiscoverScreenProps): React.JSX.Element {
  const { authorizedRequest } = useAuth();
  const { t } = useLanguage();
  const [didLoad, setDidLoad] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [linkInput, setLinkInput] = useState('');
  const [linkAnalysis, setLinkAnalysis] = useState<LinkDiscoverResult | null>(
    null,
  );
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [analyzingLink, setAnalyzingLink] = useState(false);
  const [planDraft, setPlanDraft] = useState<DiscoverPlanDraft | null>(null);
  const [planningPlaceKey, setPlanningPlaceKey] = useState<string | null>(null);
  const [savingPlaceKey, setSavingPlaceKey] = useState<string | null>(null);
  const [savedPlaceIdsByKey, setSavedPlaceIdsByKey] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    if (didLoad) {
      return;
    }

    setDidLoad(true);

    const loadSavedPlaces = async () => {
      setLoadingSaved(true);

      try {
        const data = await listPlaces(authorizedRequest);
        setSavedPlaceIdsByKey(
          data.items.reduce<Record<string, string>>((result, item) => {
            result[buildSearchPlaceKey(item)] = item.id;
            return result;
          }, {}),
        );
      } catch (caughtError) {
        setFeedback(extractErrorMessage(caughtError));
      } finally {
        setLoadingSaved(false);
      }
    };

    loadSavedPlaces().catch(caughtError => {
      setLoadingSaved(false);
      setFeedback(extractErrorMessage(caughtError));
    });
  }, [authorizedRequest, didLoad]);

  const handleSaveSearchPlace = async (
    place: SearchPlace,
    options: { announce: boolean },
  ): Promise<string> => {
    const placeKey = buildSearchPlaceKey(place);
    setSavingPlaceKey(placeKey);

    if (options.announce) {
      setFeedback(null);
    }

    try {
      const data = await savePlace(authorizedRequest, place);
      setSavedPlaceIdsByKey(currentMap => {
        return {
          ...currentMap,
          [placeKey]: data.id,
        };
      });

      if (options.announce) {
        setFeedback(t('discover_place_saved'));
      }

      return data.id;
    } catch (caughtError) {
      if (
        caughtError instanceof ApiError &&
        caughtError.code === 'PLACE_DUPLICATED'
      ) {
        const existingPlaceId = extractExistingPlaceId(caughtError.details);

        if (existingPlaceId) {
          setSavedPlaceIdsByKey(currentMap => {
            return {
              ...currentMap,
              [placeKey]: existingPlaceId,
            };
          });

          if (options.announce) {
            setFeedback(t('discover_place_exists'));
          }

          return existingPlaceId;
        }
      }

      if (options.announce) {
        setFeedback(extractErrorMessage(caughtError));
      }

      throw caughtError;
    } finally {
      setSavingPlaceKey(null);
    }
  };

  const handleAnalyzeLink = async (requestedLinkInput: string = linkInput) => {
    const normalizedLink = normalizeDiscoverLinkInput(requestedLinkInput);

    if (!normalizedLink) {
      setFeedback(t('discover_link_required'));
      return;
    }

    if (normalizedLink !== linkInput) {
      setLinkInput(normalizedLink);
    }

    setAnalyzingLink(true);
    setPlanDraft(null);
    setFeedback(null);

    try {
      const data = await discoverPlacesFromLink(
        authorizedRequest,
        normalizedLink,
      );
      setLinkAnalysis(data);
    } catch (caughtError) {
      setLinkAnalysis(null);
      setPlanDraft(null);
      setFeedback(extractErrorMessage(caughtError));
    } finally {
      setAnalyzingLink(false);
    }
  };

  useEffect(() => {
    if (!incomingLinkRequest) {
      return;
    }

    onIncomingLinkHandled?.(incomingLinkRequest.key);
    handleAnalyzeLink(incomingLinkRequest.url).catch(() => undefined);
  }, [incomingLinkRequest, onIncomingLinkHandled]);

  const handleOpenMap = async (item: LinkDiscoverItem) => {
    if (!item.mapUrl) {
      setFeedback(t('discover_link_map_unavailable'));
      return;
    }

    try {
      await Linking.openURL(item.mapUrl);
    } catch {
      setFeedback(t('discover_link_map_unavailable'));
    }
  };

  const handleOpenSourcePage = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      setFeedback(t('discover_link_source_unavailable'));
    }
  };

  const candidateNames = buildCandidateNames(linkAnalysis);
  const planningPlaceDraftKey = planDraft
    ? buildSearchPlaceKey(planDraft.place)
    : null;

  const handleOpenPlan = (place: LinkDiscoverItem) => {
    setPlanDraft({
      memo: '',
      place,
      scheduledAtInput: buildDefaultDiscoverScheduleDraft(),
      title: t('discover_plan_default_title', {
        place: place.name,
      }),
    });
    setFeedback(null);
  };

  const handleSubmitPlan = async () => {
    if (!planDraft) {
      return;
    }

    const normalizedTitle = planDraft.title.trim();

    if (!normalizedTitle) {
      setFeedback(t('calendar_title_required'));
      return;
    }

    const scheduledAt = parseDateTimeInput(planDraft.scheduledAtInput);

    if (!scheduledAt) {
      setFeedback(t('calendar_date_format_error'));
      return;
    }

    const placeKey = buildSearchPlaceKey(planDraft.place);
    setPlanningPlaceKey(placeKey);
    setFeedback(null);

    try {
      const placeId =
        savedPlaceIdsByKey[placeKey] ??
        (await handleSaveSearchPlace(planDraft.place, {
          announce: false,
        }));

      await createSchedule(authorizedRequest, {
        title: normalizedTitle,
        scheduledAt,
        memo: normalizeMemo(planDraft.memo),
        placeId,
      });

      setPlanDraft(null);
      onScheduleCreated(extractDateKey(scheduledAt));
    } catch (caughtError) {
      setFeedback(extractErrorMessage(caughtError));
    } finally {
      setPlanningPlaceKey(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.title}>{t('discover_title')}</Text>
      </View>

      <View style={styles.panel}>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setLinkInput}
          onSubmitEditing={() => {
            handleAnalyzeLink().catch(() => undefined);
          }}
          placeholder={t('discover_link_placeholder')}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          testID="discover-link-input"
          value={linkInput}
        />

        <Pressable
          disabled={analyzingLink}
          onPress={() => {
            handleAnalyzeLink().catch(() => undefined);
          }}
          style={styles.primaryButton}
          testID="discover-link-submit"
        >
          {analyzingLink ? (
            <ActivityIndicator color={colors.surfaceElevated} size="small" />
          ) : (
            <Text style={styles.primaryButtonLabel}>
              {t('discover_link_action')}
            </Text>
          )}
        </Pressable>
      </View>

      {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}

      {loadingSaved ? (
        <View style={styles.loadingBlock}>
          <ActivityIndicator color={colors.textSecondary} size="small" />
        </View>
      ) : null}

      {linkAnalysis ? (
        <>
          <View style={styles.analysisCard}>
            <Text style={styles.panelEyebrow}>{t('discover_link_source')}</Text>
            <Text style={styles.panelTitle}>
              {linkAnalysis.page.title ?? linkAnalysis.page.url}
            </Text>

            {linkAnalysis.page.description ? (
              <Text style={styles.panelDescription}>
                {linkAnalysis.page.description}
              </Text>
            ) : null}

            {linkAnalysis.analysis.kind === 'multi' ? (
              <View
                style={[
                  styles.analysisNotice,
                  linkAnalysis.analysis.status === 'partial'
                    ? styles.analysisNoticePartial
                    : styles.analysisNoticeReady,
                ]}
              >
                <Text style={styles.analysisNoticeTitle}>
                  {buildAnalysisNoticeTitle(linkAnalysis, t)}
                </Text>
                <Text style={styles.analysisNoticeBody}>
                  {buildAnalysisNoticeBody(linkAnalysis, t)}
                </Text>
              </View>
            ) : null}

            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>
                {t('discover_link_source_url')}
              </Text>
              <Text style={styles.metaValue}>{linkAnalysis.page.url}</Text>
            </View>

            {linkAnalysis.page.locationHints.length > 0 ? (
              <View style={styles.metaBlock}>
                <Text style={styles.metaLabel}>
                  {t('discover_link_detected_locations')}
                </Text>
                <Text style={styles.metaValue}>
                  {linkAnalysis.page.locationHints.join(' · ')}
                </Text>
              </View>
            ) : null}

            {linkAnalysis.queryHints.length > 0 ? (
              <View style={styles.metaBlock}>
                <Text style={styles.metaLabel}>
                  {t('discover_link_query_hints')}
                </Text>
                <Text style={styles.metaValue}>
                  {linkAnalysis.queryHints.join(' · ')}
                </Text>
              </View>
            ) : null}

            {candidateNames.length > 0 ? (
              <View style={styles.metaBlock}>
                <Text style={styles.metaLabel}>
                  {t('discover_link_detected_names')}
                </Text>
                <View style={styles.hintChipRow}>
                  {candidateNames.map(name => {
                    return (
                      <View
                        key={`candidate-${name}`}
                        style={styles.hintChip}
                      >
                        <Text style={styles.hintChipLabel}>{name}</Text>
                      </View>
                    );
                  })}
                </View>
                <Text style={styles.metaHint}>
                  {t('discover_link_candidate_hint')}
                </Text>
              </View>
            ) : null}

            {linkAnalysis.page.contentPreview ? (
              <View style={styles.metaBlock}>
                <Text style={styles.metaLabel}>
                  {t('discover_link_preview')}
                </Text>
                <Text style={styles.metaValue}>
                  {linkAnalysis.page.contentPreview}
                </Text>
              </View>
            ) : null}

            <Pressable
              onPress={() => {
                handleOpenSourcePage(linkAnalysis.page.url).catch(
                  () => undefined,
                );
              }}
              style={styles.sourceLinkButton}
              testID="discover-link-open-source"
            >
              <Text style={styles.sourceLinkButtonLabel}>
                {t('discover_link_open_source')}
              </Text>
            </Pressable>
          </View>

          {linkAnalysis.items.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {t('discover_link_results')}
              </Text>

              <View style={styles.cardList}>
                {linkAnalysis.items.map(item => {
                  const itemKey = buildSearchPlaceKey(item);
                  const isSaved = Boolean(savedPlaceIdsByKey[itemKey]);
                  const isPlanning = planningPlaceKey === itemKey;
                  const isPlanOpen = planningPlaceDraftKey === itemKey;
                  const isSaving = savingPlaceKey === itemKey;
                  const matchConfidenceLabel = buildMatchConfidenceLabel(
                    item.matchConfidence,
                    t,
                  );
                  const categoryLabel = buildSearchPlaceCategoryLabel(item);
                  const matchReasonTexts = buildMatchReasonTexts(
                    item.matchReasons,
                    t,
                  );

                  return (
                    <View key={itemKey} style={styles.card}>
                      <View style={styles.cardHeader}>
                        <Text style={styles.providerLabel}>
                          {item.locationHint ?? item.provider.toUpperCase()}
                        </Text>
                        <View
                          style={[
                            styles.confidenceBadge,
                            buildConfidenceBadgeStyle(item.matchConfidence),
                          ]}
                        >
                          <Text style={styles.confidenceBadgeLabel}>
                            {matchConfidenceLabel}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.cardTitle}>{item.name}</Text>
                      <Text style={styles.cardSummary}>{item.address}</Text>

                      {categoryLabel ? (
                        <View style={styles.metaBlock}>
                          <Text style={styles.metaLabel}>
                            {t('search_place_category')}
                          </Text>
                          <Text style={styles.metaValue}>{categoryLabel}</Text>
                        </View>
                      ) : null}

                      {item.roadAddress &&
                      item.roadAddress !== item.address ? (
                        <View style={styles.metaBlock}>
                          <Text style={styles.metaLabel}>
                            {t('search_place_road_address')}
                          </Text>
                          <Text style={styles.metaValue}>
                            {item.roadAddress}
                          </Text>
                        </View>
                      ) : null}

                      {item.phone ? (
                        <View style={styles.metaBlock}>
                          <Text style={styles.metaLabel}>
                            {t('search_place_phone')}
                          </Text>
                          <Text style={styles.metaValue}>{item.phone}</Text>
                        </View>
                      ) : null}

                      <View style={styles.metaBlock}>
                        <Text style={styles.metaLabel}>
                          {t('search_place_coordinates')}
                        </Text>
                        <Text style={styles.metaValue}>
                          {formatCoordinates(item)}
                        </Text>
                      </View>

                      <View style={styles.metaBlock}>
                        <Text style={styles.metaLabel}>
                          {t('discover_link_matched_query')}
                        </Text>
                        <Text style={styles.metaValue}>
                          {item.matchedQuery}
                        </Text>
                      </View>

                      {matchReasonTexts.length > 0 ? (
                        <View style={styles.metaBlock}>
                          <Text style={styles.metaLabel}>
                            {t('discover_link_match_reasons')}
                          </Text>
                          <Text style={styles.metaValue}>
                            {matchReasonTexts.join(' · ')}
                          </Text>
                        </View>
                      ) : null}

                      {item.locationHint ? (
                        <View style={styles.metaBlock}>
                          <Text style={styles.metaLabel}>
                            {t('discover_link_location_hint')}
                          </Text>
                          <Text style={styles.metaValue}>
                            {item.locationHint}
                          </Text>
                        </View>
                      ) : null}

                      <View style={styles.actionRow}>
                        <Pressable
                          disabled={isSaved || isSaving || isPlanning}
                          onPress={() => {
                            handleSaveSearchPlace(item, {
                              announce: true,
                            }).catch(() => undefined);
                          }}
                          style={[
                            styles.secondaryButton,
                            isSaved ? styles.secondaryButtonSaved : null,
                          ]}
                          testID={`discover-link-save-${item.providerPlaceId}`}
                        >
                          {isSaving ? (
                            <ActivityIndicator
                              color={colors.textPrimary}
                              size="small"
                            />
                          ) : (
                            <Text style={styles.secondaryButtonLabel}>
                              {isSaved
                                ? t('discover_saved')
                                : t('discover_save')}
                            </Text>
                          )}
                        </Pressable>

                        <Pressable
                          disabled={!item.mapUrl || isPlanning}
                          onPress={() => {
                            handleOpenMap(item).catch(() => undefined);
                          }}
                          style={[
                            styles.ghostButton,
                            !item.mapUrl ? styles.ghostButtonDisabled : null,
                          ]}
                          testID={`discover-link-map-${item.providerPlaceId}`}
                        >
                          <Text style={styles.ghostButtonLabel}>
                            {t('discover_link_open_map')}
                          </Text>
                        </Pressable>
                      </View>

                      <Pressable
                        disabled={isPlanning}
                        onPress={() => {
                          handleOpenPlan(item);
                        }}
                        style={styles.planButton}
                        testID={`discover-link-plan-${item.providerPlaceId}`}
                      >
                        <Text style={styles.planButtonLabel}>
                          {t('discover_plan')}
                        </Text>
                      </Pressable>

                      {isPlanOpen && planDraft ? (
                        <View
                          style={styles.planEditor}
                          testID={`discover-plan-editor-${item.providerPlaceId}`}
                        >
                          <Text style={styles.planEditorTitle}>
                            {t('discover_plan_title')}
                          </Text>
                          <Text style={styles.planEditorHint}>
                            {isSaved
                              ? t('discover_plan_hint_saved')
                              : t('discover_plan_hint_auto_save')}
                          </Text>
                          <Text style={styles.planEditorMeta}>
                            {t('discover_plan_meta')}
                          </Text>

                          <TextInput
                            onChangeText={nextValue => {
                              setPlanDraft(currentDraft => {
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
                            style={styles.input}
                            testID="discover-plan-title-input"
                            value={planDraft.title}
                          />

                          <TextInput
                            autoCapitalize="none"
                            onChangeText={nextValue => {
                              setPlanDraft(currentDraft => {
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
                            testID="discover-plan-date-input"
                            value={planDraft.scheduledAtInput}
                          />

                          <TextInput
                            multiline
                            onChangeText={nextValue => {
                              setPlanDraft(currentDraft => {
                                if (!currentDraft) {
                                  return currentDraft;
                                }

                                return {
                                  ...currentDraft,
                                  memo: nextValue,
                                };
                              });
                            }}
                            placeholder={t('discover_plan_memo_placeholder')}
                            placeholderTextColor={colors.textMuted}
                            style={[styles.input, styles.planMemoInput]}
                            testID="discover-plan-memo-input"
                            value={planDraft.memo}
                          />

                          <View style={styles.planActionRow}>
                            <Pressable
                              disabled={isPlanning}
                              onPress={() => {
                                setPlanDraft(null);
                              }}
                              style={styles.planCancelButton}
                              testID="discover-plan-cancel"
                            >
                              <Text style={styles.planCancelButtonLabel}>
                                {t('discover_plan_cancel')}
                              </Text>
                            </Pressable>

                            <Pressable
                              disabled={isPlanning}
                              onPress={() => {
                                handleSubmitPlan().catch(() => undefined);
                              }}
                              style={styles.planSubmitButton}
                              testID="discover-plan-submit"
                            >
                              {isPlanning ? (
                                <ActivityIndicator
                                  color={colors.surfaceElevated}
                                  size="small"
                                />
                              ) : (
                                <Text style={styles.planSubmitButtonLabel}>
                                  {t('discover_plan_submit')}
                                </Text>
                              )}
                            </Pressable>
                          </View>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          {linkAnalysis.items.length === 0 ? (
            <Text style={styles.emptyState}>
              {buildDiscoverEmptyStateMessage(linkAnalysis, candidateNames, t)}
            </Text>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function buildSearchPlaceKey(
  place: Pick<SearchPlace, 'provider' | 'providerPlaceId'>,
): string {
  return `${place.provider}:${place.providerPlaceId}`;
}

function buildMatchConfidenceLabel(
  confidence: LinkDiscoverItem['matchConfidence'],
  t: ReturnType<typeof useLanguage>['t'],
): string {
  switch (confidence) {
    case 'high':
      return t('discover_link_confidence_high');
    case 'medium':
      return t('discover_link_confidence_medium');
    case 'low':
    default:
      return t('discover_link_confidence_low');
  }
}

function buildMatchReasonTexts(
  reasons: LinkDiscoverItem['matchReasons'],
  t: ReturnType<typeof useLanguage>['t'],
): string[] {
  return reasons.map(reason => {
    switch (reason.type) {
      case 'query':
        return t('discover_link_reason_query', {
          query: reason.query,
        });
      case 'location':
        return t('discover_link_reason_location', {
          location: reason.location,
        });
      case 'titleTokens':
        return t('discover_link_reason_title_tokens', {
          tokens: reason.tokens.join(', '),
        });
      case 'searchRank':
        return t('discover_link_reason_search_rank', {
          rank: reason.rank,
        });
      default:
        return '';
    }
  });
}

function buildConfidenceBadgeStyle(
  confidence: LinkDiscoverItem['matchConfidence'],
): StyleProp<ViewStyle> {
  switch (confidence) {
    case 'high':
      return styles.confidenceBadgeHigh;
    case 'medium':
      return styles.confidenceBadgeMedium;
    case 'low':
    default:
      return styles.confidenceBadgeLow;
  }
}

function buildCandidateNames(
  linkAnalysis: LinkDiscoverResult | null,
): string[] {
  if (!linkAnalysis) {
    return [];
  }

  const matchedNames = new Set(
    linkAnalysis.items.flatMap(item => {
      return [
        normalizeComparableValue(item.name),
        normalizeComparableValue(item.matchedQuery),
      ];
    }),
  );

  return [
    ...new Set(
      linkAnalysis.queryHints
        .map(value => value.trim())
        .filter(Boolean)
        .filter(value => !matchedNames.has(normalizeComparableValue(value))),
    ),
  ];
}

function buildAnalysisNoticeTitle(
  linkAnalysis: LinkDiscoverResult,
  t: ReturnType<typeof useLanguage>['t'],
): string {
  return linkAnalysis.analysis.status === 'partial'
    ? t('discover_link_multi_partial_title')
    : t('discover_link_multi_title');
}

function buildAnalysisNoticeBody(
  linkAnalysis: LinkDiscoverResult,
  t: ReturnType<typeof useLanguage>['t'],
): string {
  if (linkAnalysis.analysis.status === 'partial') {
    return t('discover_link_multi_partial_body', {
      detectedCount: linkAnalysis.analysis.detectedNameCount,
      matchedCount: linkAnalysis.analysis.matchedItemCount,
    });
  }

  return t('discover_link_multi_body', {
    detectedCount: linkAnalysis.analysis.detectedNameCount,
    matchedCount: linkAnalysis.analysis.matchedItemCount,
  });
}

function buildDiscoverEmptyStateMessage(
  linkAnalysis: LinkDiscoverResult,
  candidateNames: string[],
  t: ReturnType<typeof useLanguage>['t'],
): string {
  if (
    linkAnalysis.analysis.kind === 'multi' &&
    linkAnalysis.analysis.status === 'partial'
  ) {
    return t('discover_link_multi_partial_empty');
  }

  return candidateNames.length > 0
    ? t('discover_link_no_matchable_results')
    : t('discover_link_no_results');
}

function buildSearchPlaceCategoryLabel(
  place: Pick<SearchPlace, 'categoryName' | 'categoryGroupName'>,
): string | null {
  return place.categoryName ?? place.categoryGroupName ?? null;
}

function formatCoordinates(place: Pick<SearchPlace, 'lat' | 'lng'>): string {
  return `${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}`;
}

function extractExistingPlaceId(details: unknown): string | null {
  if (!details || typeof details !== 'object') {
    return null;
  }

  const existingPlaceId = (details as { existingPlaceId?: unknown })
    .existingPlaceId;

  return typeof existingPlaceId === 'string' ? existingPlaceId : null;
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'unexpected error';
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeComparableValue(value: string): string {
  return slugify(value);
}

function normalizeDiscoverLinkInput(value: string): string {
  const trimmedValue = decodeDiscoverLinkCandidate(value.trim());

  if (!trimmedValue) {
    return '';
  }

  const withoutLeadingSlash = trimmedValue.replace(/^\/+/, '');
  const normalizedUrlCandidate = /^https?:\/\//i.test(withoutLeadingSlash)
    ? withoutLeadingSlash
    : `https://${withoutLeadingSlash}`;

  try {
    const parsedUrl = new URL(normalizedUrlCandidate);

    if (parsedUrl.hostname.toLowerCase() === 'l.instagram.com') {
      const nestedUrl = parsedUrl.searchParams.get('u');

      if (nestedUrl) {
        return normalizeDiscoverLinkInput(nestedUrl);
      }
    }

    return parsedUrl.toString();
  } catch {
    return normalizedUrlCandidate;
  }
}

function decodeDiscoverLinkCandidate(value: string): string {
  let nextValue = value;

  for (let index = 0; index < 2; index += 1) {
    try {
      const decodedValue = decodeURIComponent(nextValue);

      if (decodedValue === nextValue) {
        break;
      }

      nextValue = decodedValue;
    } catch {
      break;
    }
  }

  return nextValue;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function buildDefaultDiscoverScheduleDraft(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate(),
  )} 18:30`;
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

function extractDateKey(isoString: string): string {
  const date = new Date(isoString);

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}`;
}

function normalizeMemo(value: string): string | null {
  const trimmedValue = value.trim();

  return trimmedValue ? trimmedValue : null;
}

const styles = StyleSheet.create({
  container: {
    gap: 18,
    paddingTop: 4,
  },
  hero: {
    gap: 0,
  },
  title: {
    color: journalTokens.color.textStrong,
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  panel: {
    borderTopColor: journalTokens.color.rule,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 12,
    paddingTop: 18,
  },
  analysisCard: {
    borderTopColor: journalTokens.color.rule,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
    paddingTop: 18,
  },
  panelEyebrow: {
    color: journalTokens.color.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  panelTitle: {
    color: journalTokens.color.textStrong,
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  panelDescription: {
    color: journalTokens.color.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  analysisNotice: {
    borderRadius: journalTokens.radius.soft,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  analysisNoticeReady: {
    backgroundColor: journalTokens.color.pageSurface,
    borderColor: journalTokens.color.ruleStrong,
    borderWidth: 1,
  },
  analysisNoticePartial: {
    backgroundColor: journalTokens.color.accentSoft,
    borderColor: journalTokens.color.ruleStrong,
    borderWidth: 1,
  },
  analysisNoticeTitle: {
    color: journalTokens.color.textStrong,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  analysisNoticeBody: {
    color: journalTokens.color.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  metaHint: {
    color: journalTokens.color.textMuted,
    fontSize: 12,
    lineHeight: 17,
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
  input: {
    backgroundColor: 'transparent',
    borderBottomColor: journalTokens.color.rule,
    borderBottomWidth: StyleSheet.hairlineWidth,
    color: journalTokens.color.textPrimary,
    fontSize: 15,
    minHeight: 46,
    paddingHorizontal: 0,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: journalTokens.color.accent,
    borderRadius: journalTokens.radius.soft,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
  },
  primaryButtonLabel: {
    color: journalTokens.color.inverseText,
    fontSize: 13,
    fontWeight: '600',
  },
  section: {
    gap: 14,
  },
  sectionTitle: {
    color: journalTokens.color.textStrong,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  emptyState: {
    color: journalTokens.color.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  cardList: {
    borderTopColor: journalTokens.color.rule,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 0,
  },
  card: {
    borderBottomColor: journalTokens.color.rule,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
    paddingVertical: 16,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  providerLabel: {
    color: journalTokens.color.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  confidenceBadge: {
    borderRadius: journalTokens.radius.round,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  confidenceBadgeHigh: {
    backgroundColor: journalTokens.color.accentSoft,
  },
  confidenceBadgeMedium: {
    backgroundColor: journalTokens.color.pageSubtle,
  },
  confidenceBadgeLow: {
    backgroundColor: journalTokens.color.pageSurface,
    borderColor: journalTokens.color.ruleStrong,
    borderWidth: 1,
  },
  confidenceBadgeLabel: {
    color: journalTokens.color.textPrimary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  cardTitle: {
    color: journalTokens.color.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  cardSummary: {
    color: journalTokens.color.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  metaBlock: {
    gap: 4,
  },
  metaLabel: {
    color: journalTokens.color.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  metaValue: {
    color: journalTokens.color.textPrimary,
    fontSize: 13,
    lineHeight: 18,
  },
  hintChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  hintChip: {
    backgroundColor: journalTokens.color.pageSurface,
    borderColor: journalTokens.color.ruleStrong,
    borderRadius: journalTokens.radius.round,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  hintChipLabel: {
    color: journalTokens.color.textPrimary,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  sourceLinkButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: journalTokens.color.pageSurface,
    borderColor: journalTokens.color.ruleStrong,
    borderRadius: journalTokens.radius.soft,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 12,
  },
  sourceLinkButtonLabel: {
    color: journalTokens.color.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: journalTokens.color.pageSurface,
    borderColor: journalTokens.color.ruleStrong,
    borderRadius: journalTokens.radius.soft,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 16,
  },
  secondaryButtonSaved: {
    backgroundColor: journalTokens.color.accentSoft,
  },
  secondaryButtonLabel: {
    color: journalTokens.color.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  ghostButton: {
    alignItems: 'center',
    backgroundColor: journalTokens.color.pageSurface,
    borderColor: journalTokens.color.ruleStrong,
    borderRadius: journalTokens.radius.soft,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 16,
  },
  ghostButtonDisabled: {
    opacity: 0.4,
  },
  ghostButtonLabel: {
    color: journalTokens.color.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  planButton: {
    alignItems: 'center',
    backgroundColor: journalTokens.color.accentSoft,
    borderRadius: journalTokens.radius.soft,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 16,
  },
  planButtonLabel: {
    color: journalTokens.color.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  planEditor: {
    backgroundColor: journalTokens.color.pageSurface,
    borderColor: journalTokens.color.rule,
    borderRadius: journalTokens.radius.soft,
    borderWidth: 1,
    gap: 10,
    marginTop: 2,
    padding: 14,
  },
  planEditorTitle: {
    color: journalTokens.color.textStrong,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  planEditorHint: {
    color: journalTokens.color.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  planEditorMeta: {
    color: journalTokens.color.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  planMemoInput: {
    minHeight: 90,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  planActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  planCancelButton: {
    alignItems: 'center',
    borderColor: journalTokens.color.ruleStrong,
    borderRadius: journalTokens.radius.soft,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 16,
  },
  planCancelButtonLabel: {
    color: journalTokens.color.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  planSubmitButton: {
    alignItems: 'center',
    backgroundColor: journalTokens.color.accent,
    borderRadius: journalTokens.radius.soft,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 16,
  },
  planSubmitButtonLabel: {
    color: journalTokens.color.inverseText,
    fontSize: 13,
    fontWeight: '600',
  },
});
