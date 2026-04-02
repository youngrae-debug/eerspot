import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ApiError } from '../../../shared/api/http';
import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { colors } from '../../../shared/theme/colors';
import { useAuth } from '../../auth/context/AuthContext';
import { listPlaces, savePlace } from '../../places/api/placesApi';
import type { SearchPlace } from '../../places/types';
import {
  discoverPlacesFromLink,
  type LinkDiscoverItem,
  type LinkDiscoverResult,
} from '../api/discoverApi';

type DiscoverScreenProps = {
  onScheduleCreated: (dateKey: string) => void;
};

export function DiscoverScreen(_props: DiscoverScreenProps): React.JSX.Element {
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
      if (caughtError instanceof ApiError && caughtError.code === 'PLACE_DUPLICATED') {
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

  const handleAnalyzeLink = async () => {
    const normalizedLink = linkInput.trim();

    if (!normalizedLink) {
      setFeedback(t('discover_link_required'));
      return;
    }

    setAnalyzingLink(true);
    setFeedback(null);

    try {
      const data = await discoverPlacesFromLink(authorizedRequest, normalizedLink);
      setLinkAnalysis(data);
    } catch (caughtError) {
      setLinkAnalysis(null);
      setFeedback(extractErrorMessage(caughtError));
    } finally {
      setAnalyzingLink(false);
    }
  };

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

  const candidateNames = buildCandidateNames(linkAnalysis);
  const candidatePlaces = buildCandidatePlaces(linkAnalysis);

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>{t('discover_eyebrow')}</Text>
        <Text style={styles.title}>{t('discover_title')}</Text>
        <Text style={styles.description}>{t('discover_description')}</Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelEyebrow}>{t('discover_link_eyebrow')}</Text>
        <Text style={styles.panelTitle}>{t('discover_link_title')}</Text>
        <Text style={styles.panelDescription}>
          {t('discover_link_description')}
        </Text>

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
          testID="discover-link-submit">
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

            {linkAnalysis.page.contentPreview ? (
              <View style={styles.metaBlock}>
                <Text style={styles.metaLabel}>{t('discover_link_preview')}</Text>
                <Text style={styles.metaValue}>
                  {linkAnalysis.page.contentPreview}
                </Text>
              </View>
            ) : null}
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
                  const isSaving = savingPlaceKey === itemKey;

                  return (
                    <View key={itemKey} style={styles.card}>
                      <View style={styles.cardHeader}>
                        <View style={styles.neighborhoodBadge}>
                          <Text style={styles.neighborhoodBadgeLabel}>
                            {item.locationHint ?? item.provider.toUpperCase()}
                          </Text>
                        </View>
                        <Text style={styles.providerLabel}>
                          {item.provider.toUpperCase()}
                        </Text>
                      </View>

                      <Text style={styles.cardTitle}>{item.name}</Text>
                      <Text style={styles.cardSummary}>{item.address}</Text>

                      <View style={styles.metaBlock}>
                        <Text style={styles.metaLabel}>
                          {t('discover_link_matched_query')}
                        </Text>
                        <Text style={styles.metaValue}>{item.matchedQuery}</Text>
                      </View>

                      {item.locationHint ? (
                        <View style={styles.metaBlock}>
                          <Text style={styles.metaLabel}>
                            {t('discover_link_location_hint')}
                          </Text>
                          <Text style={styles.metaValue}>{item.locationHint}</Text>
                        </View>
                      ) : null}

                      <View style={styles.actionRow}>
                        <Pressable
                          disabled={isSaved || isSaving}
                          onPress={() => {
                            handleSaveSearchPlace(item, { announce: true }).catch(
                              () => undefined,
                            );
                          }}
                          style={[
                            styles.secondaryButton,
                            isSaved ? styles.secondaryButtonSaved : null,
                          ]}
                          testID={`discover-link-save-${item.providerPlaceId}`}>
                          {isSaving ? (
                            <ActivityIndicator
                              color={colors.textPrimary}
                              size="small"
                            />
                          ) : (
                            <Text style={styles.secondaryButtonLabel}>
                              {isSaved ? t('discover_saved') : t('discover_save')}
                            </Text>
                          )}
                        </Pressable>

                        <Pressable
                          disabled={!item.mapUrl}
                          onPress={() => {
                            handleOpenMap(item).catch(() => undefined);
                          }}
                          style={[
                            styles.ghostButton,
                            !item.mapUrl ? styles.ghostButtonDisabled : null,
                          ]}
                          testID={`discover-link-map-${item.providerPlaceId}`}>
                          <Text style={styles.ghostButtonLabel}>
                            {t('discover_link_open_map')}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          {candidatePlaces.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {t('discover_link_detected_names')}
              </Text>

              <View style={styles.cardList}>
                {candidatePlaces.map(candidatePlace => {
                  const candidateKey = buildSearchPlaceKey(candidatePlace);
                  const isSaved = Boolean(savedPlaceIdsByKey[candidateKey]);
                  const isSaving = savingPlaceKey === candidateKey;

                  return (
                    <View
                      key={candidateKey}
                      style={styles.card}
                      testID={`discover-link-candidate-${slugify(candidatePlace.name)}`}>
                      <View style={styles.cardHeader}>
                        <View style={styles.neighborhoodBadge}>
                          <Text style={styles.neighborhoodBadgeLabel}>
                            {candidatePlace.locationHint ?? 'LINK'}
                          </Text>
                        </View>
                        <Text style={styles.providerLabel}>LINK</Text>
                      </View>

                      <Text style={styles.cardTitle}>{candidatePlace.name}</Text>
                      <Text style={styles.cardSummary}>
                        {t('discover_link_candidate_hint')}
                      </Text>

                      {candidatePlace.locationHint ? (
                        <View style={styles.metaBlock}>
                          <Text style={styles.metaLabel}>
                            {t('discover_link_location_hint')}
                          </Text>
                          <Text style={styles.metaValue}>
                            {candidatePlace.locationHint}
                          </Text>
                        </View>
                      ) : null}

                      {candidatePlace.sourceTitle ? (
                        <View style={styles.metaBlock}>
                          <Text style={styles.metaLabel}>
                            {t('discover_link_source')}
                          </Text>
                          <Text style={styles.metaValue}>
                            {candidatePlace.sourceTitle}
                          </Text>
                        </View>
                      ) : null}

                      <View style={styles.actionRow}>
                        <Pressable
                          disabled={isSaved || isSaving}
                          onPress={() => {
                            handleSaveSearchPlace(candidatePlace, {
                              announce: true,
                            }).catch(() => undefined);
                          }}
                          style={[
                            styles.secondaryButton,
                            isSaved ? styles.secondaryButtonSaved : null,
                          ]}
                          testID={`discover-link-candidate-save-${slugify(candidatePlace.name)}`}>
                          {isSaving ? (
                            <ActivityIndicator
                              color={colors.textPrimary}
                              size="small"
                            />
                          ) : (
                            <Text style={styles.secondaryButtonLabel}>
                              {isSaved ? t('discover_saved') : t('discover_save')}
                            </Text>
                          )}
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          {linkAnalysis.items.length === 0 && candidateNames.length === 0 ? (
            <Text style={styles.emptyState}>{t('discover_link_no_results')}</Text>
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

function buildCandidateNames(linkAnalysis: LinkDiscoverResult | null): string[] {
  if (!linkAnalysis) {
    return [];
  }

  const matchedNames = new Set(
    linkAnalysis.items.flatMap(item => {
      return [normalizeComparableValue(item.name), normalizeComparableValue(item.matchedQuery)];
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

type CandidatePlace = SearchPlace & {
  locationHint: string | null;
  sourceTitle: string | null;
};

function buildCandidatePlaces(
  linkAnalysis: LinkDiscoverResult | null,
): CandidatePlace[] {
  if (!linkAnalysis) {
    return [];
  }

  return buildCandidateNames(linkAnalysis).map(candidateName => {
    const locationHint = linkAnalysis.page.locationHints[0] ?? null;

    return {
      address: buildCandidateAddress(linkAnalysis),
      lat: 0,
      lng: 0,
      locationHint,
      mapUrl: null,
      name: candidateName,
      provider: DISCOVER_CANDIDATE_PROVIDER,
      providerPlaceId: buildCandidateProviderPlaceId(candidateName, locationHint),
      sourceTitle: linkAnalysis.page.title,
    };
  });
}

function extractExistingPlaceId(details: unknown): string | null {
  if (!details || typeof details !== 'object') {
    return null;
  }

  const existingPlaceId = (details as { existingPlaceId?: unknown }).existingPlaceId;

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

function buildCandidateProviderPlaceId(
  candidateName: string,
  locationHint: string | null,
): string {
  return `discover_${slugify(
    [locationHint, candidateName].filter(Boolean).join(' '),
  )}`;
}

function buildCandidateAddress(linkAnalysis: LinkDiscoverResult): string {
  const locationLabel = linkAnalysis.page.locationHints.join(' · ');
  const titleLabel = truncate(linkAnalysis.page.title ?? extractHostname(linkAnalysis.page.url), 56);

  return [locationLabel, titleLabel].filter(Boolean).join(' · ') || 'Link discovery';
}

function normalizeComparableValue(value: string): string {
  return slugify(value);
}

function extractHostname(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return value;
  }
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

const DISCOVER_CANDIDATE_PROVIDER: SearchPlace['provider'] = 'kakao';

const styles = StyleSheet.create({
  container: {
    gap: 18,
  },
  hero: {
    gap: 12,
  },
  eyebrow: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.textPrimary,
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -0.9,
  },
  description: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 24,
  },
  panel: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: 30,
    borderWidth: 1,
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  analysisCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 28,
    borderWidth: 1,
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  panelEyebrow: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  panelTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  panelDescription: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  feedback: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  loadingBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    color: colors.textPrimary,
    fontSize: 15,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 16,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  primaryButtonLabel: {
    color: colors.surfaceElevated,
    fontSize: 14,
    fontWeight: '700',
  },
  section: {
    gap: 14,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  emptyState: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  cardList: {
    gap: 16,
  },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: 28,
    borderWidth: 1,
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  neighborhoodBadge: {
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  neighborhoodBadgeLabel: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  providerLabel: {
    color: colors.textMuted,
    flexShrink: 1,
    fontSize: 13,
    marginLeft: 12,
    textAlign: 'right',
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  cardSummary: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  metaBlock: {
    gap: 4,
  },
  metaLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  metaValue: {
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 22,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  secondaryButtonSaved: {
    backgroundColor: colors.divider,
  },
  secondaryButtonLabel: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  ghostButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  ghostButtonDisabled: {
    opacity: 0.4,
  },
  ghostButtonLabel: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
});
