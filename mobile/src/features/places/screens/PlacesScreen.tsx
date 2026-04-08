import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ApiError } from '../../../shared/api/http';
import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { colors } from '../../../shared/theme/colors';
import { journalTokens } from '../../../shared/theme/journalTokens';
import { useAuth } from '../../auth/context/AuthContext';
import {
  deletePlace,
  getPlace,
  listPlaces,
  savePlace,
  searchPlaces,
  updatePlace,
} from '../api/placesApi';
import type { SavedPlace, SearchPlace } from '../types';

type SavedFilter = 'all' | 'favorites';
type SavedSort = 'recent' | 'name';

type DetailDraft = {
  isFavorite: boolean;
  note: string;
};

export function PlacesScreen(): React.JSX.Element {
  const { authorizedRequest } = useAuth();
  const { t } = useLanguage();
  const [didLoad, setDidLoad] = useState(false);
  const [query, setQuery] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchPlace[]>([]);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<SavedPlace | null>(null);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [savingPlaceId, setSavingPlaceId] = useState<string | null>(null);
  const [savingDetailPlaceId, setSavingDetailPlaceId] = useState<string | null>(
    null,
  );
  const [deletingPlaceId, setDeletingPlaceId] = useState<string | null>(null);
  const [savedFilter, setSavedFilter] = useState<SavedFilter>('all');
  const [savedSort, setSavedSort] = useState<SavedSort>('recent');
  const [detailDraft, setDetailDraft] = useState<DetailDraft | null>(null);

  useEffect(() => {
    if (didLoad) {
      return;
    }

    setDidLoad(true);

    const loadInitialPlaces = async () => {
      setLoadingSaved(true);

      try {
        const data = await listPlaces(authorizedRequest);
        setSavedPlaces(data.items);
      } catch (caughtError) {
        handleAsyncError(caughtError);
      } finally {
        setLoadingSaved(false);
      }
    };

    loadInitialPlaces().catch(handleAsyncError);
  }, [authorizedRequest, didLoad]);

  const filteredSavedPlaces = useMemo(() => {
    const nextItems = savedPlaces.filter(place => {
      if (savedFilter === 'favorites') {
        return Boolean(place.isFavorite);
      }

      return true;
    });

    return [...nextItems].sort((left, right) => {
      if (savedSort === 'name') {
        return left.name.localeCompare(right.name);
      }

      return right.savedAt.localeCompare(left.savedAt);
    });
  }, [savedFilter, savedPlaces, savedSort]);

  const hasDetailChanges =
    selectedPlace && detailDraft
      ? normalizeNoteDraft(detailDraft.note) !== (selectedPlace.note ?? null) ||
        detailDraft.isFavorite !== Boolean(selectedPlace.isFavorite)
      : false;

  const loadSavedPlaces = async () => {
    setLoadingSaved(true);

    try {
      const data = await listPlaces(authorizedRequest);
      setSavedPlaces(data.items);

      if (selectedPlace) {
        const refreshedSelectedPlace = data.items.find(
          item => item.id === selectedPlace.id,
        );

        if (refreshedSelectedPlace) {
          setSelectedPlace(refreshedSelectedPlace);
          setDetailDraft(createDetailDraft(refreshedSelectedPlace));
        } else {
          setSelectedPlace(null);
          setDetailDraft(null);
        }
      }
    } catch (caughtError) {
      setFeedback(extractErrorMessage(caughtError));
    } finally {
      setLoadingSaved(false);
    }
  };

  const runSearch = async () => {
    const nextQuery = query.trim();

    if (!nextQuery) {
      setSearchResults([]);
      setFeedback(null);
      return;
    }

    setLoadingSearch(true);
    setFeedback(null);

    try {
      const items = await searchPlaces(authorizedRequest, nextQuery);
      setSearchResults(items);
    } catch (caughtError) {
      setFeedback(extractErrorMessage(caughtError));
    } finally {
      setLoadingSearch(false);
    }
  };

  const openPlaceDetail = async (placeId: string) => {
    setLoadingDetail(true);

    try {
      const place = await getPlace(authorizedRequest, placeId);
      setSelectedPlace(place);
      setDetailDraft(createDetailDraft(place));
      setFeedback(null);
    } catch (caughtError) {
      setFeedback(extractErrorMessage(caughtError));
    } finally {
      setLoadingDetail(false);
    }
  };

  const saveSearchResult = async (place: SearchPlace) => {
    setSavingPlaceId(place.providerPlaceId);
    setFeedback(null);

    try {
      const data = await savePlace(authorizedRequest, place);
      await loadSavedPlaces();
      await openPlaceDetail(data.id);
      setFeedback(t('search_place_saved'));
    } catch (caughtError) {
      if (
        caughtError instanceof ApiError &&
        caughtError.code === 'PLACE_DUPLICATED'
      ) {
        const existingPlaceId = extractExistingPlaceId(caughtError.details);

        await loadSavedPlaces();

        if (existingPlaceId) {
          await openPlaceDetail(existingPlaceId);
        }

        setFeedback(caughtError.message);
      } else {
        setFeedback(extractErrorMessage(caughtError));
      }
    } finally {
      setSavingPlaceId(null);
    }
  };

  const handleSaveDetail = async () => {
    if (!selectedPlace || !detailDraft) {
      return;
    }

    setSavingDetailPlaceId(selectedPlace.id);
    setFeedback(null);

    try {
      const updatedPlace = await updatePlace(
        authorizedRequest,
        selectedPlace.id,
        {
          note: normalizeNoteDraft(detailDraft.note),
          isFavorite: detailDraft.isFavorite,
        },
      );

      setSelectedPlace(updatedPlace);
      setDetailDraft(createDetailDraft(updatedPlace));
      setSavedPlaces(currentPlaces => {
        return currentPlaces.map(place => {
          return place.id === updatedPlace.id ? updatedPlace : place;
        });
      });
      setFeedback(t('search_place_updated'));
    } catch (caughtError) {
      setFeedback(extractErrorMessage(caughtError));
    } finally {
      setSavingDetailPlaceId(null);
    }
  };

  const handleDeleteSelectedPlace = async () => {
    if (!selectedPlace) {
      return;
    }

    setDeletingPlaceId(selectedPlace.id);
    setFeedback(null);

    try {
      await deletePlace(authorizedRequest, selectedPlace.id);
      setSavedPlaces(currentPlaces => {
        return currentPlaces.filter(place => place.id !== selectedPlace.id);
      });
      setSelectedPlace(null);
      setDetailDraft(null);
      setFeedback(t('search_place_deleted'));
    } catch (caughtError) {
      setFeedback(extractErrorMessage(caughtError));
    } finally {
      setDeletingPlaceId(null);
    }
  };

  const handleAsyncError = (caughtError: unknown) => {
    setFeedback(extractErrorMessage(caughtError));
  };

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>{t('search_title')}</Text>
      </View>

      <View style={styles.divider} />

      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={nextValue => {
          setQuery(nextValue);

          if (nextValue.trim().length === 0) {
            setSearchResults([]);
            setFeedback(null);
          }
        }}
        onSubmitEditing={() => {
          runSearch().catch(handleAsyncError);
        }}
        placeholder={t('search_placeholder')}
        placeholderTextColor={colors.textMuted}
        returnKeyType="search"
        style={styles.searchInput}
        value={query}
      />

      {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>
          {t('search_results_count', { count: searchResults.length })}
        </Text>
        {loadingSearch ? (
          <ActivityIndicator color={colors.textSecondary} size="small" />
        ) : null}
      </View>

      <View style={styles.divider} />

      {searchResults.length === 0 ? (
        <Text style={styles.emptyText}>
          {query.trim().length === 0
            ? t('search_empty_state')
            : t('search_no_provider_results')}
        </Text>
      ) : (
        <View style={styles.listSection}>
          {searchResults.map((result, index) => (
            <View key={result.providerPlaceId}>
              <View style={styles.row}>
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>{result.name}</Text>
                  <Text style={styles.rowMeta}>{result.address}</Text>
                </View>
                <ActionText
                  disabled={savingPlaceId === result.providerPlaceId}
                  label={
                    savingPlaceId === result.providerPlaceId
                      ? t('search_saving')
                      : t('search_save')
                  }
                  onPress={() => {
                    saveSearchResult(result).catch(handleAsyncError);
                  }}
                />
              </View>

              {index < searchResults.length - 1 ? (
                <View style={styles.divider} />
              ) : null}
            </View>
          ))}
        </View>
      )}

      <View style={styles.sectionGap} />
      <View style={styles.savedSectionHeader}>
        <Text style={styles.sectionTitle}>
          {t('search_saved_places_title')}
        </Text>
        <Text style={styles.savedCount}>
          {t('search_saved_places_count', {
            count: filteredSavedPlaces.length,
          })}
        </Text>
      </View>
      <View style={styles.divider} />

      <View style={styles.controlRow}>
        <ChipButton
          active={savedFilter === 'all'}
          label={t('search_saved_filter_all')}
          onPress={() => setSavedFilter('all')}
        />
        <ChipButton
          active={savedFilter === 'favorites'}
          label={t('search_saved_filter_favorites')}
          onPress={() => setSavedFilter('favorites')}
        />
      </View>

      <View style={styles.controlRow}>
        <ChipButton
          active={savedSort === 'recent'}
          label={t('search_saved_sort_recent')}
          onPress={() => setSavedSort('recent')}
        />
        <ChipButton
          active={savedSort === 'name'}
          label={t('search_saved_sort_name')}
          onPress={() => setSavedSort('name')}
        />
      </View>

      {loadingSaved ? (
        <View style={styles.loadingBlock}>
          <ActivityIndicator color={colors.textSecondary} size="small" />
        </View>
      ) : filteredSavedPlaces.length === 0 ? (
        <Text style={styles.emptyText}>
          {savedPlaces.length === 0
            ? t('search_no_saved_places')
            : t('search_saved_places_empty_filtered')}
        </Text>
      ) : (
        <View style={styles.listSection}>
          {filteredSavedPlaces.map((place, index) => {
            const isSelected = selectedPlace?.id === place.id;

            return (
              <View key={place.id}>
                <Pressable
                  onPress={() => {
                    openPlaceDetail(place.id).catch(handleAsyncError);
                  }}
                  style={[
                    styles.savedRow,
                    isSelected ? styles.savedRowSelected : null,
                  ]}
                  testID={`saved-place-row-${place.id}`}
                >
                  <View style={styles.rowCopy}>
                    <View style={styles.savedRowTitleLine}>
                      <Text
                        style={[
                          styles.rowTitle,
                          isSelected ? styles.rowTitleSelected : null,
                        ]}
                      >
                        {place.name}
                      </Text>
                      {place.isFavorite ? (
                        <View style={styles.savedBadge}>
                          <Text style={styles.savedBadgeLabel}>
                            {t('search_place_favorite_badge')}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.rowMeta}>{place.address}</Text>
                    <Text style={styles.savedSubmeta}>
                      {`${place.provider.toUpperCase()} · ${formatDateLabel(
                        place.savedAt,
                      )}`}
                    </Text>
                  </View>
                  <Text style={styles.savedMeta}>
                    {t('search_selected_place')}
                  </Text>
                </Pressable>

                {index < filteredSavedPlaces.length - 1 ? (
                  <View style={styles.divider} />
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.divider} />

      {loadingDetail ? (
        <View style={styles.loadingBlock}>
          <ActivityIndicator color={colors.textSecondary} size="small" />
        </View>
      ) : selectedPlace && detailDraft ? (
        <View style={styles.detailCard}>
          <View style={styles.detailHeader}>
            <View style={styles.detailHeaderCopy}>
              <Text style={styles.detailTitle}>{selectedPlace.name}</Text>
            </View>
            <Pressable
              onPress={() => {
                setDetailDraft(currentDraft => {
                  if (!currentDraft) {
                    return currentDraft;
                  }

                  return {
                    ...currentDraft,
                    isFavorite: !currentDraft.isFavorite,
                  };
                });
              }}
              style={[
                styles.favoriteButton,
                detailDraft.isFavorite ? styles.favoriteButtonActive : null,
              ]}
              testID="place-detail-favorite-button"
            >
              <Text
                style={[
                  styles.favoriteButtonLabel,
                  detailDraft.isFavorite
                    ? styles.favoriteButtonLabelActive
                    : null,
                ]}
              >
                {detailDraft.isFavorite
                  ? t('search_place_unfavorite')
                  : t('search_place_favorite')}
              </Text>
            </Pressable>
          </View>

          <Text style={styles.detailText}>{selectedPlace.address}</Text>

          <View style={styles.detailMetaGrid}>
            <DetailMetaItem
              label={t('search_place_provider')}
              value={selectedPlace.provider.toUpperCase()}
            />
            <DetailMetaItem
              label={t('search_place_saved_at')}
              value={formatDateLabel(selectedPlace.savedAt)}
            />
            <DetailMetaItem
              label={t('search_place_updated_at')}
              value={formatDateLabel(selectedPlace.updatedAt)}
            />
            <DetailMetaItem
              label={t('search_place_coordinates')}
              value={formatCoordinates(selectedPlace)}
            />
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>{t('search_place_note')}</Text>
            <TextInput
              multiline
              onChangeText={nextValue => {
                setDetailDraft(currentDraft => {
                  if (!currentDraft) {
                    return currentDraft;
                  }

                  return {
                    ...currentDraft,
                    note: nextValue,
                  };
                });
              }}
              placeholder={t('search_place_note_placeholder')}
              placeholderTextColor={colors.textMuted}
              style={[styles.searchInput, styles.noteInput]}
              testID="place-detail-note-input"
              value={detailDraft.note}
            />
          </View>

          <View style={styles.detailActions}>
            <Pressable
              disabled={
                deletingPlaceId === selectedPlace.id ||
                savingDetailPlaceId === selectedPlace.id
              }
              onPress={() => {
                handleDeleteSelectedPlace().catch(handleAsyncError);
              }}
              style={styles.deleteButton}
              testID="place-detail-delete-button"
            >
              {deletingPlaceId === selectedPlace.id ? (
                <ActivityIndicator
                  color={colors.surfaceElevated}
                  size="small"
                />
              ) : (
                <Text style={styles.deleteButtonLabel}>
                  {t('search_place_delete')}
                </Text>
              )}
            </Pressable>

            <Pressable
              disabled={
                !hasDetailChanges ||
                deletingPlaceId === selectedPlace.id ||
                savingDetailPlaceId === selectedPlace.id
              }
              onPress={() => {
                handleSaveDetail().catch(handleAsyncError);
              }}
              style={[
                styles.saveButton,
                !hasDetailChanges ? styles.buttonDisabledSurface : null,
              ]}
              testID="place-detail-save-button"
            >
              {savingDetailPlaceId === selectedPlace.id ? (
                <ActivityIndicator
                  color={colors.surfaceElevated}
                  size="small"
                />
              ) : (
                <Text style={styles.saveButtonLabel}>
                  {t('search_place_save_changes')}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.detailPlaceholder}>
          <Text style={styles.emptyText}>{t('search_place_detail_hint')}</Text>
        </View>
      )}
    </View>
  );
}

type ActionTextProps = {
  disabled?: boolean;
  label: string;
  onPress: () => void;
};

function ActionText({
  disabled = false,
  label,
  onPress,
}: ActionTextProps): React.JSX.Element {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={styles.actionTextButton}
    >
      <Text
        style={[
          styles.actionTextLabel,
          disabled ? styles.buttonDisabled : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

type ChipButtonProps = {
  active: boolean;
  label: string;
  onPress: () => void;
};

function ChipButton({
  active,
  label,
  onPress,
}: ChipButtonProps): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chipButton, active ? styles.chipButtonActive : null]}
    >
      <Text
        style={[
          styles.chipButtonLabel,
          active ? styles.chipButtonLabelActive : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

type DetailMetaItemProps = {
  label: string;
  value: string;
};

function DetailMetaItem({
  label,
  value,
}: DetailMetaItemProps): React.JSX.Element {
  return (
    <View style={styles.detailMetaItem}>
      <Text style={styles.detailMetaLabel}>{label}</Text>
      <Text style={styles.detailMetaValue}>{value}</Text>
    </View>
  );
}

function createDetailDraft(place: SavedPlace): DetailDraft {
  return {
    isFavorite: Boolean(place.isFavorite),
    note: place.note ?? '',
  };
}

function formatCoordinates(place: Pick<SearchPlace, 'lat' | 'lng'>): string {
  return `${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}`;
}

function formatDateLabel(value: string): string {
  return new Date(value).toLocaleDateString();
}

function normalizeNoteDraft(note: string): string | null {
  const trimmedNote = note.trim();

  return trimmedNote ? trimmedNote : null;
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'unexpected error';
}

function extractExistingPlaceId(details: unknown): string | null {
  if (!details || typeof details !== 'object') {
    return null;
  }

  const existingPlaceId = (details as { existingPlaceId?: unknown })
    .existingPlaceId;

  return typeof existingPlaceId === 'string' ? existingPlaceId : null;
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
    paddingTop: 4,
  },
  hero: {
    gap: 0,
  },
  heroTitle: {
    color: journalTokens.color.textStrong,
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  divider: {
    backgroundColor: journalTokens.color.rule,
    height: StyleSheet.hairlineWidth,
  },
  searchInput: {
    backgroundColor: 'transparent',
    borderBottomColor: journalTokens.color.rule,
    borderBottomWidth: StyleSheet.hairlineWidth,
    color: journalTokens.color.textPrimary,
    fontSize: 15,
    minHeight: 46,
    paddingHorizontal: 0,
  },
  feedback: {
    color: journalTokens.color.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaText: {
    color: journalTokens.color.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  sectionGap: {
    height: 8,
  },
  sectionTitle: {
    color: journalTokens.color.textStrong,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  listSection: {
    gap: 0,
  },
  loadingBlock: {
    paddingVertical: 8,
  },
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  rowCopy: {
    flex: 1,
    gap: 4,
  },
  savedRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  savedRowSelected: {
    backgroundColor: journalTokens.color.accentSoft,
    paddingHorizontal: 8,
  },
  savedRowTitleLine: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  rowTitle: {
    color: journalTokens.color.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  rowMeta: {
    color: journalTokens.color.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  rowTitleSelected: {
    color: journalTokens.color.textStrong,
  },
  savedMeta: {
    color: journalTokens.color.textMuted,
    fontSize: 11,
    paddingTop: 4,
  },
  savedSubmeta: {
    color: journalTokens.color.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  savedBadge: {
    backgroundColor: journalTokens.color.pageSurface,
    borderColor: journalTokens.color.ruleStrong,
    borderRadius: journalTokens.radius.round,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  savedBadgeLabel: {
    color: journalTokens.color.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  actionTextButton: {
    justifyContent: 'center',
    minHeight: 32,
  },
  actionTextLabel: {
    color: journalTokens.color.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  savedSectionHeader: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  savedCount: {
    color: journalTokens.color.textMuted,
    fontSize: 12,
    lineHeight: 18,
    paddingTop: 4,
  },
  controlRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipButton: {
    backgroundColor: journalTokens.color.pageSurface,
    borderColor: journalTokens.color.ruleStrong,
    borderRadius: journalTokens.radius.round,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 34,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipButtonActive: {
    backgroundColor: journalTokens.color.accentSoft,
    borderColor: journalTokens.color.accent,
  },
  chipButtonLabel: {
    color: journalTokens.color.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  chipButtonLabelActive: {
    color: journalTokens.color.textStrong,
  },
  detailCard: {
    borderTopColor: journalTokens.color.rule,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 16,
    paddingTop: 18,
  },
  detailPlaceholder: {
    borderTopColor: journalTokens.color.rule,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
    paddingTop: 18,
  },
  detailHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  detailHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  detailTitle: {
    color: journalTokens.color.textStrong,
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
  },
  detailText: {
    color: journalTokens.color.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  favoriteButton: {
    backgroundColor: journalTokens.color.pageSurface,
    borderColor: journalTokens.color.ruleStrong,
    borderRadius: journalTokens.radius.round,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  favoriteButtonActive: {
    backgroundColor: journalTokens.color.accentSoft,
    borderColor: journalTokens.color.accent,
  },
  favoriteButtonLabel: {
    color: journalTokens.color.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  favoriteButtonLabelActive: {
    color: journalTokens.color.textStrong,
  },
  detailMetaGrid: {
    gap: 0,
  },
  detailMetaItem: {
    borderBottomColor: journalTokens.color.rule,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  detailMetaLabel: {
    color: journalTokens.color.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  detailMetaValue: {
    color: journalTokens.color.textPrimary,
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18,
    textAlign: 'right',
  },
  fieldBlock: {
    gap: 8,
  },
  fieldLabel: {
    color: journalTokens.color.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    lineHeight: 16,
    textTransform: 'uppercase',
  },
  noteInput: {
    minHeight: 140,
    paddingBottom: 10,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  detailActions: {
    flexDirection: 'row',
    gap: 10,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: journalTokens.color.accent,
    borderRadius: journalTokens.radius.soft,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
  },
  saveButtonLabel: {
    color: journalTokens.color.inverseText,
    fontSize: 13,
    fontWeight: '600',
  },
  deleteButton: {
    alignItems: 'center',
    backgroundColor: journalTokens.color.pageSurface,
    borderColor: journalTokens.color.ruleStrong,
    borderRadius: journalTokens.radius.soft,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
  },
  deleteButtonLabel: {
    color: journalTokens.color.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  emptyText: {
    color: journalTokens.color.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonDisabledSurface: {
    opacity: 0.45,
  },
});
