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
      if (caughtError instanceof ApiError && caughtError.code === 'PLACE_DUPLICATED') {
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
      const updatedPlace = await updatePlace(authorizedRequest, selectedPlace.id, {
        note: normalizeNoteDraft(detailDraft.note),
        isFavorite: detailDraft.isFavorite,
      });

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
        <Text style={styles.heroSubtitle}>{t('search_intro')}</Text>
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
        {loadingSearch ? <ActivityIndicator color={colors.textSecondary} size="small" /> : null}
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

              {index < searchResults.length - 1 ? <View style={styles.divider} /> : null}
            </View>
          ))}
        </View>
      )}

      <View style={styles.sectionGap} />
      <View style={styles.savedSectionHeader}>
        <View style={styles.savedSectionCopy}>
          <Text style={styles.sectionTitle}>{t('search_saved_places_title')}</Text>
          <Text style={styles.sectionDescription}>
            {t('search_saved_places_desc')}
          </Text>
        </View>
        <Text style={styles.savedCount}>
          {t('search_saved_places_count', { count: filteredSavedPlaces.length })}
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
                  testID={`saved-place-row-${place.id}`}>
                  <View style={styles.rowCopy}>
                    <View style={styles.savedRowTitleLine}>
                      <Text
                        style={[
                          styles.rowTitle,
                          isSelected ? styles.rowTitleSelected : null,
                        ]}>
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
              <Text style={styles.detailEyebrow}>{t('search_selected_place')}</Text>
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
              testID="place-detail-favorite-button">
              <Text
                style={[
                  styles.favoriteButtonLabel,
                  detailDraft.isFavorite
                    ? styles.favoriteButtonLabelActive
                    : null,
                ]}>
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
              testID="place-detail-delete-button">
              {deletingPlaceId === selectedPlace.id ? (
                <ActivityIndicator color={colors.surfaceElevated} size="small" />
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
              testID="place-detail-save-button">
              {savingDetailPlaceId === selectedPlace.id ? (
                <ActivityIndicator color={colors.surfaceElevated} size="small" />
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
          <Text style={styles.detailEyebrow}>{t('search_selected_place')}</Text>
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
    <Pressable disabled={disabled} onPress={onPress} style={styles.actionTextButton}>
      <Text style={[styles.actionTextLabel, disabled ? styles.buttonDisabled : null]}>
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
      style={[styles.chipButton, active ? styles.chipButtonActive : null]}>
      <Text
        style={[styles.chipButtonLabel, active ? styles.chipButtonLabelActive : null]}>
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

  const existingPlaceId = (details as { existingPlaceId?: unknown }).existingPlaceId;

  return typeof existingPlaceId === 'string' ? existingPlaceId : null;
}

const styles = StyleSheet.create({
  container: {
    gap: 18,
    paddingTop: 56,
  },
  hero: {
    gap: 18,
  },
  heroTitle: {
    color: colors.textPrimary,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.8,
    lineHeight: 36,
  },
  heroSubtitle: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 24,
  },
  divider: {
    backgroundColor: colors.divider,
    height: 1,
  },
  searchInput: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: 0,
    borderWidth: 1,
    color: colors.textPrimary,
    fontSize: 15,
    minHeight: 56,
    paddingHorizontal: 16,
  },
  feedback: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  sectionGap: {
    height: 18,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  sectionDescription: {
    color: colors.textSecondary,
    fontSize: 13,
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
    paddingVertical: 10,
  },
  rowCopy: {
    flex: 1,
    gap: 4,
  },
  savedRow: {
    alignItems: 'flex-start',
    borderRadius: 18,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  savedRowSelected: {
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
  },
  savedRowTitleLine: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  rowTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
  },
  rowMeta: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  rowTitleSelected: {
    color: colors.accent,
  },
  savedMeta: {
    color: colors.textMuted,
    fontSize: 12,
    paddingTop: 4,
  },
  savedSubmeta: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  savedBadge: {
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  savedBadgeLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  actionTextButton: {
    justifyContent: 'center',
    minHeight: 32,
  },
  actionTextLabel: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  detailBlock: {
    gap: 6,
  },
  savedSectionHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  savedSectionCopy: {
    flex: 1,
    gap: 4,
  },
  savedCount: {
    color: colors.textMuted,
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
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 36,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipButtonActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipButtonLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  chipButtonLabelActive: {
    color: colors.surfaceElevated,
  },
  detailCard: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    gap: 16,
    padding: 18,
  },
  detailPlaceholder: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    gap: 10,
    padding: 18,
  },
  detailHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  detailHeaderCopy: {
    flex: 1,
    gap: 6,
  },
  detailEyebrow: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    lineHeight: 18,
    textTransform: 'uppercase',
  },
  detailTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 28,
  },
  detailText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  favoriteButton: {
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 36,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  favoriteButtonActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  favoriteButtonLabel: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  favoriteButtonLabelActive: {
    color: colors.surfaceElevated,
  },
  detailMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  detailMetaItem: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    gap: 4,
    minWidth: '47%',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  detailMetaLabel: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  detailMetaValue: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
  },
  fieldBlock: {
    gap: 8,
  },
  fieldLabel: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
  },
  noteInput: {
    minHeight: 120,
    paddingBottom: 16,
    paddingTop: 16,
    textAlignVertical: 'top',
  },
  detailActions: {
    flexDirection: 'row',
    gap: 10,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 16,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  saveButtonLabel: {
    color: colors.surfaceElevated,
    fontSize: 14,
    fontWeight: '700',
  },
  deleteButton: {
    alignItems: 'center',
    backgroundColor: colors.danger,
    borderRadius: 16,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  deleteButtonLabel: {
    color: colors.surfaceElevated,
    fontSize: 14,
    fontWeight: '700',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 24,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonDisabledSurface: {
    opacity: 0.45,
  },
});
