import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { journalTokens } from '../../../shared/theme/journalTokens';
import { useAuth } from '../../auth/context/AuthContext';
import {
  addPlaceToCollection,
  createPlaceCollection,
  deletePlaceCollection,
  deletePlace,
  getPlace,
  listPlaceCollections,
  listPlaces,
  removePlaceFromCollection,
  savePlace,
  searchPlaces,
  updatePlace,
} from '../api/placesApi';
import type { PlaceCollection, SavedPlace, SearchPlace } from '../types';

type SavedFilter = 'all' | 'favorites';
type SavedSort = 'recent' | 'name';

type DetailDraft = {
  isFavorite: boolean;
  note: string;
};

type SavedCoverPalette = {
  badge: { backgroundColor: string };
  label: { color: string };
  panel: { backgroundColor: string };
  tileAccent: { backgroundColor: string };
  tileHighlight: { backgroundColor: string };
  tileSoft: { backgroundColor: string };
  tileStrong: { backgroundColor: string };
};

type PlacesScreenMode = 'combined' | 'search' | 'saved';
type Translate = ReturnType<typeof useLanguage>['t'];

type PlacesScreenProps = {
  mode?: PlacesScreenMode;
  onCreateScheduleForPlace?: (place: SavedPlace) => void;
};

export function PlacesScreen({
  mode = 'combined',
  onCreateScheduleForPlace,
}: PlacesScreenProps = {}): React.JSX.Element {
  const { authorizedRequest } = useAuth();
  const { language, t } = useLanguage();
  const [didLoad, setDidLoad] = useState(false);
  const [query, setQuery] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchPlace[]>([]);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [collections, setCollections] = useState<PlaceCollection[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<SavedPlace | null>(null);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [savingPlaceId, setSavingPlaceId] = useState<string | null>(null);
  const [savingDetailPlaceId, setSavingDetailPlaceId] = useState<string | null>(
    null,
  );
  const [deletingPlaceId, setDeletingPlaceId] = useState<string | null>(null);
  const [deletingCollectionId, setDeletingCollectionId] = useState<string | null>(
    null,
  );
  const [savingCollectionId, setSavingCollectionId] = useState<string | null>(
    null,
  );
  const [savedFilter, setSavedFilter] = useState<SavedFilter>('all');
  const [savedSort, setSavedSort] = useState<SavedSort>('recent');
  const [savedTopTab, setSavedTopTab] = useState<'saved' | 'recommended'>(
    'saved',
  );
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(
    null,
  );
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [collectionDraftName, setCollectionDraftName] = useState('');
  const [detailDraft, setDetailDraft] = useState<DetailDraft | null>(null);
  const [selectedSearchResult, setSelectedSearchResult] =
    useState<SearchPlace | null>(null);

  useEffect(() => {
    if (didLoad) {
      return;
    }

    setDidLoad(true);

    const loadInitialPlaces = async () => {
      setLoadingSaved(true);
      setLoadingCollections(true);

      try {
        const [placesData, collectionsData] = await Promise.all([
          listPlaces(authorizedRequest),
          listPlaceCollections(authorizedRequest),
        ]);

        setSavedPlaces(placesData.items);
        setCollections(collectionsData.items);
      } catch (caughtError) {
        handleAsyncError(caughtError);
      } finally {
        setLoadingSaved(false);
        setLoadingCollections(false);
      }
    };

    loadInitialPlaces().catch(handleAsyncError);
  }, [authorizedRequest, didLoad]);

  const selectedCollection = useMemo(() => {
    if (!selectedCollectionId) {
      return null;
    }

    return (
      collections.find(collection => collection.id === selectedCollectionId) ?? null
    );
  }, [collections, selectedCollectionId]);
  const filteredSavedPlaces = useMemo(() => {
    const nextItems = savedPlaces.filter(place => {
      if (
        selectedCollection &&
        !selectedCollection.placeIds.includes(place.id)
      ) {
        return false;
      }

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
  }, [savedFilter, savedPlaces, savedSort, selectedCollection]);

  const hasDetailChanges =
    selectedPlace && detailDraft
      ? normalizeNoteDraft(detailDraft.note) !== (selectedPlace.note ?? null) ||
        detailDraft.isFavorite !== Boolean(selectedPlace.isFavorite)
      : false;
  const isSearchActionDisabled = query.trim().length === 0 || loadingSearch;
  const showSearchSection = mode !== 'saved';
  const showSavedSection = mode !== 'search';
  const showSavedHeader = mode === 'combined';
  const isSavedMode = mode === 'saved';
  const showingSavedRecommendations = isSavedMode && savedTopTab === 'recommended';
  const heroTitle =
    mode === 'saved' ? t('search_saved_places_title') : t('search_title');
  const heroDescription =
    mode === 'saved' ? t('search_saved_places_desc') : t('search_intro');
  const recentSavedPlace = useMemo(() => {
    return [...savedPlaces].sort((left, right) => {
      return right.savedAt.localeCompare(left.savedAt);
    })[0] ?? null;
  }, [savedPlaces]);
  const recentCollectionPlaces = useMemo(() => {
    return [...savedPlaces]
      .sort((left, right) => right.savedAt.localeCompare(left.savedAt))
      .slice(0, 4);
  }, [savedPlaces]);
  const savedPlacesById = useMemo(() => {
    return savedPlaces.reduce<Record<string, SavedPlace>>((result, place) => {
      result[place.id] = place;
      return result;
    }, {});
  }, [savedPlaces]);
  const selectedPlaceCollectionIds = useMemo(() => {
    if (!selectedPlace) {
      return new Set<string>();
    }

    return new Set(
      collections
        .filter(collection => collection.placeIds.includes(selectedPlace.id))
        .map(collection => collection.id),
    );
  }, [collections, selectedPlace]);
  const selectedSearchSavedPlace = useMemo(() => {
    if (!selectedSearchResult) {
      return null;
    }

    return (
      savedPlaces.find(place => {
        return (
          buildProviderPlaceKey(place) === buildProviderPlaceKey(selectedSearchResult)
        );
      }) ?? null
    );
  }, [savedPlaces, selectedSearchResult]);
  const selectedSearchCategoryLabel = selectedSearchResult
    ? buildSearchPlaceCategoryLabel(selectedSearchResult)
    : null;
  const selectedSavedCategoryLabel = selectedPlace
    ? buildSearchPlaceCategoryLabel(selectedPlace)
    : null;

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
      setFeedback(extractErrorMessage(caughtError, t));
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
      setFeedback(extractErrorMessage(caughtError, t));
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
      setFeedback(extractErrorMessage(caughtError, t));
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCreateCollection = async () => {
    const nextName = collectionDraftName.trim();

    if (!nextName) {
      return;
    }

    setSavingCollectionId('create');
    setFeedback(null);

    try {
      const collection = await createPlaceCollection(authorizedRequest, {
        name: nextName,
      });

      setCollections(currentCollections => [collection, ...currentCollections]);
      setSelectedCollectionId(collection.id);
      setCollectionDraftName('');
      setIsCreatingCollection(false);
      setFeedback(t('search_saved_collection_created'));
    } catch (caughtError) {
      setFeedback(extractErrorMessage(caughtError, t));
    } finally {
      setSavingCollectionId(null);
    }
  };

  const handleTogglePlaceCollection = async (collection: PlaceCollection) => {
    if (!selectedPlace) {
      return;
    }

    const isIncluded = collection.placeIds.includes(selectedPlace.id);
    setSavingCollectionId(collection.id);
    setFeedback(null);

    try {
      const updatedCollection = isIncluded
        ? await removePlaceFromCollection(authorizedRequest, {
            collectionId: collection.id,
            placeId: selectedPlace.id,
          })
        : await addPlaceToCollection(authorizedRequest, {
            collectionId: collection.id,
            placeId: selectedPlace.id,
          });

      setCollections(currentCollections => {
        return currentCollections.map(currentCollection => {
          return currentCollection.id === updatedCollection.id
            ? updatedCollection
            : currentCollection;
        });
      });
      setFeedback(
        t(
          isIncluded
            ? 'search_saved_collection_membership_removed'
            : 'search_saved_collection_membership_added',
        ),
      );
    } catch (caughtError) {
      setFeedback(extractErrorMessage(caughtError, t));
    } finally {
      setSavingCollectionId(null);
    }
  };

  const handleDeleteSelectedCollection = async () => {
    if (!selectedCollection) {
      return;
    }

    setDeletingCollectionId(selectedCollection.id);
    setFeedback(null);

    try {
      await deletePlaceCollection(authorizedRequest, selectedCollection.id);
      setCollections(currentCollections => {
        return currentCollections.filter(
          collection => collection.id !== selectedCollection.id,
        );
      });
      setSelectedCollectionId(null);
      setFeedback(t('search_saved_collection_deleted'));
    } catch (caughtError) {
      setFeedback(extractErrorMessage(caughtError, t));
    } finally {
      setDeletingCollectionId(null);
    }
  };

  const confirmDeleteSelectedCollection = () => {
    if (!selectedCollection || deletingCollectionId === selectedCollection.id) {
      return;
    }

    Alert.alert(
      t('search_saved_collection_delete_confirm_title'),
      t('search_saved_collection_delete_confirm_message'),
      [
        {
          style: 'cancel',
          text: t('search_saved_collection_cancel'),
        },
        {
          style: 'destructive',
          text: t('search_saved_collection_delete'),
          onPress: () => {
            handleDeleteSelectedCollection().catch(handleAsyncError);
          },
        },
      ],
    );
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
        setFeedback(extractErrorMessage(caughtError, t));
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
      setFeedback(extractErrorMessage(caughtError, t));
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
      setCollections(currentCollections => {
        return currentCollections.map(collection => ({
          ...collection,
          placeIds: collection.placeIds.filter(placeId => placeId !== selectedPlace.id),
        }));
      });
      setSelectedPlace(null);
      setDetailDraft(null);
      setFeedback(t('search_place_deleted'));
    } catch (caughtError) {
      setFeedback(extractErrorMessage(caughtError, t));
    } finally {
      setDeletingPlaceId(null);
    }
  };

  const confirmDeleteSelectedPlace = () => {
    if (!selectedPlace || deletingPlaceId === selectedPlace.id) {
      return;
    }

    Alert.alert(
      t('search_place_delete_confirm_title'),
      t('search_place_delete_confirm_message'),
      [
        {
          style: 'cancel',
          text: t('search_saved_collection_cancel'),
        },
        {
          style: 'destructive',
          text: t('search_place_delete'),
          onPress: () => {
            handleDeleteSelectedPlace().catch(handleAsyncError);
          },
        },
      ],
    );
  };

  const handleAsyncError = (caughtError: unknown) => {
    setFeedback(extractErrorMessage(caughtError, t));
  };

  if (mode === 'search' && selectedSearchResult) {
    return (
      <View style={styles.container} testID="search-result-detail-screen">
        <Pressable
          onPress={() => {
            setSelectedSearchResult(null);
            setFeedback(null);
          }}
          style={styles.searchDetailBackButton}
          testID="search-result-detail-back-button"
        >
          <Text style={styles.searchDetailBackSymbol}>{'<'}</Text>
          <Text style={styles.searchDetailBackLabel}>
            {t('search_result_detail_back')}
          </Text>
        </Pressable>

        {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}

        <View style={[styles.detailCard, styles.detailCardElevated]}>
          <View style={styles.detailHeader}>
            <View style={styles.detailHeaderCopy}>
              <Text style={styles.detailEyebrow}>
                {t('search_result_detail_label')}
              </Text>
              <Text style={styles.detailTitle}>{selectedSearchResult.name}</Text>
            </View>
            <View style={styles.providerBadge}>
              <Text style={styles.providerBadgeLabel}>
                {selectedSearchResult.provider.toUpperCase()}
              </Text>
            </View>
          </View>

          <Text style={styles.detailText}>{selectedSearchResult.address}</Text>
          <Text style={styles.searchDetailHint}>
            {selectedSearchSavedPlace
              ? t('search_result_saved_hint')
              : t('search_result_detail_hint')}
          </Text>

          <View style={styles.detailMetaGrid}>
            {selectedSearchCategoryLabel ? (
              <DetailMetaItem
                label={t('search_place_category')}
                value={selectedSearchCategoryLabel}
              />
            ) : null}
            {selectedSearchResult.phone ? (
              <DetailMetaItem
                label={t('search_place_phone')}
                value={selectedSearchResult.phone}
              />
            ) : null}
            {selectedSearchResult.roadAddress &&
            selectedSearchResult.roadAddress !== selectedSearchResult.address ? (
              <DetailMetaItem
                label={t('search_place_road_address')}
                value={selectedSearchResult.roadAddress}
              />
            ) : null}
            <DetailMetaItem
              label={t('search_place_provider')}
              value={selectedSearchResult.provider.toUpperCase()}
            />
            <DetailMetaItem
              label={t('search_place_coordinates')}
              value={formatCoordinates(selectedSearchResult)}
            />
            {selectedSearchSavedPlace ? (
              <DetailMetaItem
                label={t('search_place_saved_at')}
                value={formatDateLabel(selectedSearchSavedPlace.savedAt)}
              />
            ) : null}
          </View>

          <View style={styles.detailActions}>
            <Pressable
              disabled={!selectedSearchResult.mapUrl}
              onPress={() => {
                if (!selectedSearchResult.mapUrl) {
                  return;
                }

                Linking.openURL(selectedSearchResult.mapUrl).catch(
                  handleAsyncError,
                );
              }}
              style={[
                styles.deleteButton,
                !selectedSearchResult.mapUrl
                  ? styles.buttonDisabledSurface
                  : null,
              ]}
              testID="search-result-detail-map-button"
            >
              <Text style={styles.deleteButtonLabel}>
                {t('discover_link_open_map')}
              </Text>
            </Pressable>

            <Pressable
              disabled={
                savingPlaceId === selectedSearchResult.providerPlaceId ||
                Boolean(selectedSearchSavedPlace)
              }
              onPress={() => {
                saveSearchResult(selectedSearchResult).catch(handleAsyncError);
              }}
              style={[
                styles.saveButton,
                savingPlaceId === selectedSearchResult.providerPlaceId ||
                selectedSearchSavedPlace
                  ? styles.buttonDisabledSurface
                  : null,
              ]}
              testID="search-result-detail-save-button"
            >
              {savingPlaceId === selectedSearchResult.providerPlaceId ? (
                <ActivityIndicator color={colors.surfaceElevated} size="small" />
              ) : (
                <Text style={styles.saveButtonLabel}>
                  {selectedSearchSavedPlace
                    ? t('search_result_saved_button')
                    : t('search_save')}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  if (mode === 'saved' && selectedPlace && detailDraft) {
    return (
      <View style={styles.container} testID="saved-place-detail-screen">
        <Pressable
          onPress={() => {
            setSelectedPlace(null);
            setDetailDraft(null);
            setFeedback(null);
          }}
          style={styles.searchDetailBackButton}
          testID="saved-place-detail-back-button"
        >
          <Text style={styles.searchDetailBackSymbol}>{'<'}</Text>
          <Text style={styles.searchDetailBackLabel}>
            {t('search_saved_detail_back')}
          </Text>
        </Pressable>

        {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}

        <View style={[styles.detailCard, styles.detailCardElevated]}>
          <View style={styles.detailHeader}>
            <View style={styles.detailHeaderCopy}>
              <Text style={styles.detailEyebrow}>
                {t('search_saved_detail_label')}
              </Text>
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
            {selectedSavedCategoryLabel ? (
              <DetailMetaItem
                label={t('search_place_category')}
                value={selectedSavedCategoryLabel}
              />
            ) : null}
            {selectedPlace.phone ? (
              <DetailMetaItem
                label={t('search_place_phone')}
                value={selectedPlace.phone}
              />
            ) : null}
            {selectedPlace.roadAddress &&
            selectedPlace.roadAddress !== selectedPlace.address ? (
              <DetailMetaItem
                label={t('search_place_road_address')}
                value={selectedPlace.roadAddress}
              />
            ) : null}
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

          <View style={styles.detailUtilityActions}>
            {selectedPlace.mapUrl ? (
              <Pressable
                onPress={() => {
                  Linking.openURL(selectedPlace.mapUrl ?? '').catch(
                    handleAsyncError,
                  );
                }}
                style={styles.detailUtilityButton}
                testID="place-detail-map-button"
              >
                <Text style={styles.detailUtilityButtonLabel}>
                  {t('discover_link_open_map')}
                </Text>
              </Pressable>
            ) : null}

            {isSavedMode && onCreateScheduleForPlace ? (
              <Pressable
                onPress={() => {
                  onCreateScheduleForPlace(selectedPlace);
                }}
                style={[
                  styles.detailUtilityButton,
                  styles.detailUtilityButtonPrimary,
                ]}
                testID="saved-place-schedule-button"
              >
                <Text
                  style={[
                    styles.detailUtilityButtonLabel,
                    styles.detailUtilityButtonLabelPrimary,
                  ]}
                >
                  {t('search_place_add_schedule')}
                </Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>
              {t('search_saved_collection_section')}
            </Text>
            {collections.length === 0 ? (
              <Text style={styles.fieldHint}>
                {t('search_saved_collection_empty')}
              </Text>
            ) : (
              <View style={styles.collectionChipWrap}>
                {collections.map(collection => {
                  const isActive = selectedPlaceCollectionIds.has(collection.id);
                  const previewCount = collection.placeIds.length;

                  return (
                    <Pressable
                      key={collection.id}
                      disabled={savingCollectionId === collection.id}
                      onPress={() => {
                        handleTogglePlaceCollection(collection).catch(
                          handleAsyncError,
                        );
                      }}
                      style={[
                        styles.collectionChip,
                        isActive ? styles.collectionChipActive : null,
                      ]}
                      testID={`place-collection-chip-${collection.id}`}
                    >
                      <Text
                        style={[
                          styles.collectionChipLabel,
                          isActive ? styles.collectionChipLabelActive : null,
                        ]}
                      >
                        {`${collection.name} · ${t('search_saved_collection_count', {
                          count: previewCount,
                        })}`}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
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
                confirmDeleteSelectedPlace();
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
                <ActivityIndicator color={colors.surfaceElevated} size="small" />
              ) : (
                <Text style={styles.saveButtonLabel}>
                  {t('search_place_save_changes')}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isSavedMode ? (
        <View style={styles.savedTopTabs}>
          <Pressable
            onPress={() => setSavedTopTab('saved')}
            style={styles.savedTopTabButton}
            testID="saved-top-tab-saved"
          >
            <Text
              style={[
                styles.savedTopTabLabel,
                savedTopTab === 'saved' ? styles.savedTopTabLabelActive : null,
              ]}
            >
              {t('search_saved_places_title')}
            </Text>
            {savedTopTab === 'saved' ? (
              <View style={styles.savedTopTabIndicator} />
            ) : null}
          </Pressable>
          <Pressable
            onPress={() => setSavedTopTab('recommended')}
            style={styles.savedTopTabButton}
            testID="saved-top-tab-recommended"
          >
            <Text
              style={[
                styles.savedTopTabLabel,
                savedTopTab === 'recommended'
                  ? styles.savedTopTabLabelActive
                  : null,
              ]}
            >
              {t('search_saved_tab_recommended')}
            </Text>
            {savedTopTab === 'recommended' ? (
              <View style={styles.savedTopTabIndicator} />
            ) : null}
          </Pressable>
        </View>
      ) : (
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>{heroTitle}</Text>
          <Text style={styles.heroDescription}>{heroDescription}</Text>
        </View>
      )}

      {showSearchSection ? (
        <View style={styles.searchComposer}>
        <View style={styles.searchInputShell}>
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
            style={styles.searchComposerInput}
            value={query}
          />
        </View>

        <Pressable
          disabled={isSearchActionDisabled}
          onPress={() => {
            runSearch().catch(handleAsyncError);
          }}
          style={[
            styles.searchButton,
            isSearchActionDisabled ? styles.buttonDisabledSurface : null,
          ]}
          testID="places-search-button"
        >
          {loadingSearch ? (
            <ActivityIndicator color={colors.surfaceElevated} size="small" />
          ) : (
            <Text style={styles.searchButtonLabel}>{t('search_search')}</Text>
          )}
        </Pressable>
        </View>
      ) : null}

      {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}

      {showSearchSection ? (
        <>
      <View style={styles.resultSectionHeader}>
        <View style={styles.sectionHeaderCopy}>
          <Text style={styles.sectionTitle}>
            {t('search_provider_results_title')}
          </Text>
          <Text style={styles.sectionDescription}>
            {t('search_provider_results_desc')}
          </Text>
        </View>
        <Text style={styles.resultCount}>
          {t('search_results_count', { count: searchResults.length })}
        </Text>
      </View>

      {searchResults.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            {query.trim().length === 0
              ? t('search_empty_state')
              : t('search_no_provider_results')}
          </Text>
        </View>
      ) : (
        <View style={styles.resultGrid}>
          {searchResults.map(result => (
            <Pressable
              key={result.providerPlaceId}
              onPress={() => {
                setSelectedSearchResult(result);
                setFeedback(null);
              }}
              style={styles.resultCard}
              testID={`search-result-card-${result.providerPlaceId}`}
            >
              <View style={styles.resultCardHeader}>
                <View style={styles.rowCopy}>
                  <View style={styles.resultTitleLine}>
                    <Text style={styles.rowTitle}>{result.name}</Text>
                    <View style={styles.providerBadge}>
                      <Text style={styles.providerBadgeLabel}>
                        {result.provider.toUpperCase()}
                      </Text>
                    </View>
                  </View>
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
            </Pressable>
          ))}
        </View>
      )}
        </>
      ) : null}

      {showSavedSection ? (
        <>
          {showSearchSection ? <View style={styles.sectionGap} /> : null}
          {showSavedHeader ? (
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
          ) : null}
          {showSavedHeader ? <View style={styles.divider} /> : null}

          {isSavedMode ? (
            showingSavedRecommendations ? (
              <View style={styles.savedRecommendedCard}>
                <Text style={styles.savedRecommendedTitle}>
                  {t('search_saved_recommended_title')}
                </Text>
                <Text style={styles.savedRecommendedDescription}>
                  {t('search_saved_recommended_description')}
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.savedCollectionSection}>
                  <View style={styles.savedCollectionSectionHeader}>
                    <Text style={styles.savedCollectionSectionTitle}>
                      {t('search_saved_collection_section')}
                    </Text>
                    <Text style={styles.savedCollectionSectionMeta}>
                      {collections.length > 0
                        ? t('search_saved_collection_count', {
                            count: collections.length,
                          })
                        : t('search_saved_collection_empty_meta')}
                    </Text>
                  </View>

                  <View
                    style={styles.savedCollectionGrid}
                    testID="saved-collection-scroller"
                  >
                    <Pressable
                      onPress={() => {
                        setSelectedCollectionId(null);

                        if (recentSavedPlace) {
                          openPlaceDetail(recentSavedPlace.id).catch(
                            handleAsyncError,
                          );
                        }
                      }}
                      style={styles.savedCollectionCard}
                      testID="saved-recent-collection-card"
                    >
                      <SavedCollectionPreview
                        places={recentCollectionPlaces}
                        testID="saved-recent-collection-preview"
                      />
                      <View style={styles.savedCollectionCopy}>
                        <Text style={styles.savedCollectionTitle}>
                          {t('search_saved_recent_collection')}
                        </Text>
                        <Text style={styles.savedCollectionMeta}>
                          {recentSavedPlace
                            ? formatRelativeDayLabel(
                                recentSavedPlace.savedAt,
                                language,
                              )
                            : t('search_saved_collection_empty_meta')}
                        </Text>
                      </View>
                    </Pressable>

                    {collections.map(collection => (
                      <Pressable
                        key={collection.id}
                        onPress={() => {
                          setSelectedCollectionId(currentCollectionId => {
                            return currentCollectionId === collection.id
                              ? null
                              : collection.id;
                          });
                          setFeedback(null);
                        }}
                        style={[
                          styles.savedCollectionCard,
                          selectedCollectionId === collection.id
                            ? styles.savedCollectionCardActive
                            : null,
                        ]}
                        testID={`saved-collection-card-${collection.id}`}
                      >
                        <SavedCollectionPreview
                          places={collection.placeIds
                            .map(placeId => savedPlacesById[placeId])
                            .filter((place): place is SavedPlace => Boolean(place))
                            .slice(0, 4)}
                          testID={`saved-collection-preview-${collection.id}`}
                        />
                        <View style={styles.savedCollectionCopy}>
                          <Text style={styles.savedCollectionTitle}>
                            {collection.name}
                          </Text>
                          <Text style={styles.savedCollectionMeta}>
                            {t('search_saved_collection_count', {
                              count: collection.placeIds.length,
                            })}
                          </Text>
                        </View>
                      </Pressable>
                    ))}

                    <Pressable
                      onPress={() => {
                        setIsCreatingCollection(true);
                        setCollectionDraftName('');
                        setFeedback(null);
                      }}
                      style={[
                        styles.savedCollectionCreateCard,
                        isCreatingCollection
                          ? styles.savedCollectionCreateCardActive
                          : null,
                      ]}
                      testID="saved-collection-start-create-button"
                    >
                      <View style={styles.savedCollectionCreatePlusWrap}>
                        <Text style={styles.savedCollectionCreatePlus}>+</Text>
                      </View>
                      <Text style={styles.savedCollectionCreateLabel}>
                        {t('search_saved_new_collection')}
                      </Text>
                    </Pressable>
                  </View>

                  {isCreatingCollection ? (
                    <View style={styles.savedCollectionCreatePanel}>
                      <Text style={styles.savedCollectionCreatePanelTitle}>
                        {t('search_saved_new_collection')}
                      </Text>
                      <TextInput
                        onChangeText={setCollectionDraftName}
                        placeholder={t('search_saved_collection_placeholder')}
                        placeholderTextColor={colors.textMuted}
                        style={styles.savedCollectionCreateInput}
                        testID="saved-collection-name-input"
                        value={collectionDraftName}
                      />
                      <View style={styles.savedCollectionCreateActions}>
                        <Pressable
                          onPress={() => {
                            setIsCreatingCollection(false);
                            setCollectionDraftName('');
                            setFeedback(null);
                          }}
                          style={styles.savedCollectionCreateSecondaryButton}
                          testID="saved-collection-cancel-button"
                        >
                          <Text
                            numberOfLines={1}
                            style={styles.savedCollectionCreateSecondaryButtonLabel}
                          >
                            {t('search_saved_collection_cancel')}
                          </Text>
                        </Pressable>
                        <Pressable
                          disabled={
                            savingCollectionId === 'create' ||
                            collectionDraftName.trim().length === 0
                          }
                          onPress={() => {
                            handleCreateCollection().catch(handleAsyncError);
                          }}
                          style={[
                            styles.savedCollectionCreatePrimaryButton,
                            savingCollectionId === 'create' ||
                            collectionDraftName.trim().length === 0
                              ? styles.buttonDisabledSurface
                              : null,
                          ]}
                          testID="saved-collection-create-button"
                        >
                          <Text
                            numberOfLines={1}
                            style={styles.savedCollectionCreatePrimaryButtonLabel}
                          >
                            {t('search_saved_collection_create')}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : null}
                </View>

                <View style={styles.savedFeedHeader}>
                  <View style={styles.savedFeedHeaderRow}>
                    <View style={styles.savedFeedHeaderCopy}>
                      <Text style={styles.savedFeedTitle}>
                        {selectedCollection
                          ? selectedCollection.name
                          : t('search_saved_feed_title', {
                              count: filteredSavedPlaces.length,
                            })}
                      </Text>
                      {selectedCollection ? (
                        <Text style={styles.savedFeedCollectionMeta}>
                          {t('search_saved_collection_count', {
                            count: filteredSavedPlaces.length,
                          })}
                        </Text>
                      ) : null}
                    </View>
                    {selectedCollection ? (
                      <Pressable
                        disabled={deletingCollectionId === selectedCollection.id}
                        onPress={() => {
                          confirmDeleteSelectedCollection();
                        }}
                        style={[
                          styles.savedCollectionDeleteButton,
                          deletingCollectionId === selectedCollection.id
                            ? styles.buttonDisabledSurface
                            : null,
                        ]}
                        testID="saved-collection-delete-button"
                      >
                        <Text style={styles.savedCollectionDeleteButtonLabel}>
                          {t('search_saved_collection_delete')}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>

                <View style={styles.savedFilterBar}>
                  <View style={styles.savedFilterChipWrap}>
                    <ChipButton
                      active={savedSort === 'recent'}
                      label={t('search_saved_sort_recent_short')}
                      onPress={() => setSavedSort('recent')}
                    />
                    <ChipButton
                      active={savedSort === 'name'}
                      label={t('search_saved_sort_name_short')}
                      onPress={() => setSavedSort('name')}
                    />
                    <ChipButton
                      active={savedFilter === 'all'}
                      label={t('search_saved_filter_all_short')}
                      onPress={() => setSavedFilter('all')}
                    />
                    <ChipButton
                      active={savedFilter === 'favorites'}
                      label={t('search_saved_filter_favorites_short')}
                      onPress={() => setSavedFilter('favorites')}
                    />
                  </View>
                </View>

                {loadingSaved || loadingCollections ? (
                  <View style={styles.loadingBlock}>
                    <ActivityIndicator
                      color={colors.textSecondary}
                      size="small"
                    />
                  </View>
                ) : filteredSavedPlaces.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyText}>
                      {selectedCollection
                        ? t('search_saved_collection_empty')
                        : savedPlaces.length === 0
                        ? t('search_no_saved_places')
                        : t('search_saved_places_empty_filtered')}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.savedFeedList}>
                    {filteredSavedPlaces.map(place => {
                      const isSelected = selectedPlace?.id === place.id;
                      const coverPalette = getSavedCoverPalette(place.id);

                      return (
                        <Pressable
                          key={place.id}
                          onPress={() => {
                            openPlaceDetail(place.id).catch(handleAsyncError);
                          }}
                          style={[
                            styles.savedFeedCard,
                            isSelected ? styles.savedFeedCardSelected : null,
                          ]}
                          testID={`saved-place-card-${place.id}`}
                        >
                          <SavedThumbnailStrip
                            name={place.name}
                            palette={coverPalette}
                            testID={`saved-place-cover-grid-${place.id}`}
                          />

                          <View style={styles.savedFeedCardBody}>
                            <View style={styles.savedFeedCardHeader}>
                              <View style={styles.savedFeedCardTitleWrap}>
                                <Text
                                  numberOfLines={1}
                                  style={styles.savedFeedCardTitle}
                                >
                                  {place.name}
                                </Text>
                                <Text
                                  numberOfLines={1}
                                  style={styles.savedFeedCardSubtitle}
                                >
                                  {buildSavedPlaceSubtitle(place)}
                                </Text>
                              </View>
                            </View>

                            <View style={styles.savedFeedMetaRow}>
                              {place.isFavorite ? (
                                <View style={styles.savedFeedFavoritePill}>
                                  <Text
                                    style={styles.savedFeedFavoritePillLabel}
                                  >
                                    {t('search_place_favorite_badge')}
                                  </Text>
                                </View>
                              ) : null}
                              <Text style={styles.savedFeedMetaText}>
                                {buildSavedPlaceMeta(place, language)}
                              </Text>
                            </View>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </>
            )
          ) : (
            <>
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

              {loadingSaved || loadingCollections ? (
                <View style={styles.loadingBlock}>
                  <ActivityIndicator color={colors.textSecondary} size="small" />
                </View>
              ) : filteredSavedPlaces.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>
                    {savedPlaces.length === 0
                      ? t('search_no_saved_places')
                      : t('search_saved_places_empty_filtered')}
                  </Text>
                </View>
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
            </>
          )}

          {!isSavedMode ? <View style={styles.divider} /> : null}

          {loadingDetail ? (
            <View style={styles.loadingBlock}>
              <ActivityIndicator color={colors.textSecondary} size="small" />
            </View>
          ) : selectedPlace && detailDraft ? (
            <View
              style={[
                styles.detailCard,
                isSavedMode ? styles.detailCardElevated : null,
              ]}
            >
              <View style={styles.detailHeader}>
                <View style={styles.detailHeaderCopy}>
                  <Text style={styles.detailTitle}>{selectedPlace.name}</Text>
                  {isSavedMode ? (
                    <Text style={styles.detailEyebrow}>
                      {t('search_saved_detail_label')}
                    </Text>
                  ) : null}
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
                {selectedSavedCategoryLabel ? (
                  <DetailMetaItem
                    label={t('search_place_category')}
                    value={selectedSavedCategoryLabel}
                  />
                ) : null}
                {selectedPlace.phone ? (
                  <DetailMetaItem
                    label={t('search_place_phone')}
                    value={selectedPlace.phone}
                  />
                ) : null}
                {selectedPlace.roadAddress &&
                selectedPlace.roadAddress !== selectedPlace.address ? (
                  <DetailMetaItem
                    label={t('search_place_road_address')}
                    value={selectedPlace.roadAddress}
                  />
                ) : null}
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

              {selectedPlace.mapUrl ? (
                <Pressable
                  onPress={() => {
                    Linking.openURL(selectedPlace.mapUrl ?? '').catch(
                      handleAsyncError,
                    );
                  }}
                  style={styles.detailUtilityButton}
                  testID="place-detail-map-button"
                >
                  <Text style={styles.detailUtilityButtonLabel}>
                    {t('discover_link_open_map')}
                  </Text>
                </Pressable>
              ) : null}

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
                    confirmDeleteSelectedPlace();
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
          ) : !isSavedMode ? (
            <View style={styles.detailPlaceholder}>
              <Text style={styles.emptyText}>{t('search_place_detail_hint')}</Text>
            </View>
          ) : null}
        </>
      ) : null}
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
      onPress={event => {
        event.stopPropagation();
        onPress();
      }}
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

type SavedCoverArtProps = {
  name: string;
  palette: SavedCoverPalette;
  testID?: string;
  variant: 'grid' | 'spotlight';
};

function SavedCoverArt({
  name,
  palette,
  testID,
  variant,
}: SavedCoverArtProps): React.JSX.Element {
  const glyphs = buildPlaceGlyphs(name);

  return (
    <View
      style={[
        styles.savedCoverArt,
        variant === 'spotlight' ? styles.savedCoverArtSpotlight : null,
      ]}
      testID={testID}
    >
      <View style={styles.savedCoverArtRow}>
        <View
          style={[
            styles.savedCoverTileLarge,
            variant === 'spotlight' ? styles.savedCoverTileLargeSpotlight : null,
            palette.tileStrong,
          ]}
        >
          <Text style={[styles.savedCoverTileGlyph, palette.label]}>
            {glyphs[0]}
          </Text>
        </View>

        <View style={styles.savedCoverTileColumn}>
          <View style={[styles.savedCoverTileSmall, palette.tileSoft]}>
            <Text style={[styles.savedCoverTileGlyphSmall, palette.label]}>
              {glyphs[1]}
            </Text>
          </View>
          <View style={[styles.savedCoverTileSmall, palette.tileHighlight]}>
            <Text style={[styles.savedCoverTileGlyphSmall, palette.label]}>
              {glyphs[2]}
            </Text>
          </View>
        </View>
      </View>

      <View style={[styles.savedCoverFooter, palette.tileAccent]}>
        <Text style={[styles.savedCoverFooterLabel, palette.label]}>
          {buildPlaceMonogram(name)}
        </Text>
      </View>
    </View>
  );
}

type SavedCollectionPreviewProps = {
  places: SavedPlace[];
  testID?: string;
};

function SavedCollectionPreview({
  places,
  testID,
}: SavedCollectionPreviewProps): React.JSX.Element {
  const previewPlaces = places.slice(0, 4);
  const previewRows = [
    previewPlaces.slice(0, 2),
    previewPlaces.slice(2, 4),
  ];

  return (
    <View style={styles.savedCollectionPreview} testID={testID}>
      {previewRows.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={styles.savedCollectionPreviewRow}>
          {[0, 1].map(columnIndex => {
            const place = row[columnIndex];

            if (!place) {
              return (
                <View
                  key={`empty-${rowIndex}-${columnIndex}`}
                  style={styles.savedCollectionTileEmpty}
                />
              );
            }

            const palette = getSavedCoverPalette(place.id);

            return (
              <View
                key={place.id}
                style={[styles.savedCollectionTile, palette.panel]}
              >
                <Text style={[styles.savedCollectionTileGlyph, palette.label]}>
                  {buildPlaceMonogram(place.name)}
                </Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

type SavedThumbnailStripProps = {
  name: string;
  palette: SavedCoverPalette;
  testID?: string;
};

function SavedThumbnailStrip({
  name,
  palette,
  testID,
}: SavedThumbnailStripProps): React.JSX.Element {
  const glyphs = buildPlaceGlyphs(name);
  const tiles = [palette.tileStrong, palette.tileSoft, palette.tileHighlight];

  return (
    <View style={styles.savedThumbnailStrip} testID={testID}>
      {tiles.map((tileStyle, index) => {
        return (
          <View
            key={`${name}-${index}`}
            style={[styles.savedThumbnailTile, tileStyle]}
          >
            <Text style={[styles.savedThumbnailGlyph, palette.label]}>
              {glyphs[index]}
            </Text>
          </View>
        );
      })}
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

function buildPlaceMonogram(name: string): string {
  const compactName = name.replace(/\s+/g, '').trim();

  return compactName.slice(0, 2).toUpperCase();
}

function buildPlaceGlyphs(name: string): [string, string, string] {
  const compactName = Array.from(name.replace(/\s+/g, '').trim().toUpperCase());

  if (compactName.length === 0) {
    return ['E', 'E', 'R'];
  }

  return [
    compactName[0],
    compactName[1] ?? compactName[0],
    compactName[2] ?? compactName[0],
  ];
}

function getSavedCoverPalette(seed: string): SavedCoverPalette {
  const palettes: SavedCoverPalette[] = [
    {
      badge: { backgroundColor: '#EADFD0' },
      label: { color: '#6A5645' },
      panel: { backgroundColor: '#F1E7DA' },
      tileAccent: { backgroundColor: '#E5D2BD' },
      tileHighlight: { backgroundColor: '#F6EDE2' },
      tileSoft: { backgroundColor: '#ECDDCA' },
      tileStrong: { backgroundColor: '#DDC4A7' },
    },
    {
      badge: { backgroundColor: '#F0DDD4' },
      label: { color: '#8A5F49' },
      panel: { backgroundColor: '#F6E8E1' },
      tileAccent: { backgroundColor: '#EFCABE' },
      tileHighlight: { backgroundColor: '#F9F0EB' },
      tileSoft: { backgroundColor: '#F0D9D1' },
      tileStrong: { backgroundColor: '#E4BBAE' },
    },
    {
      badge: { backgroundColor: '#DCE7DD' },
      label: { color: '#566957' },
      panel: { backgroundColor: '#E8F0E8' },
      tileAccent: { backgroundColor: '#D0DED1' },
      tileHighlight: { backgroundColor: '#F2F7F2' },
      tileSoft: { backgroundColor: '#DCE9DE' },
      tileStrong: { backgroundColor: '#BDD1C0' },
    },
    {
      badge: { backgroundColor: '#E8E2D8' },
      label: { color: '#695E50' },
      panel: { backgroundColor: '#F2ECE3' },
      tileAccent: { backgroundColor: '#DDD2C5' },
      tileHighlight: { backgroundColor: '#FAF5EE' },
      tileSoft: { backgroundColor: '#EBE1D4' },
      tileStrong: { backgroundColor: '#D3C2AF' },
    },
  ];
  const hash = seed.split('').reduce((total, char) => {
    return total + char.charCodeAt(0);
  }, 0);

  return palettes[hash % palettes.length];
}

function formatRelativeDayLabel(
  value: string,
  language: 'en' | 'ko' | 'ja',
): string {
  const locale = language === 'ko' ? 'ko-KR' : language === 'ja' ? 'ja-JP' : 'en-US';
  const targetDate = new Date(value);
  const today = new Date();
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const startOfTarget = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
  );
  const diffDays = Math.round(
    (startOfTarget.getTime() - startOfToday.getTime()) / 86400000,
  );

  if (
    typeof Intl !== 'undefined' &&
    typeof Intl.RelativeTimeFormat === 'function'
  ) {
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
      diffDays,
      'day',
    );
  }

  return formatRelativeDayLabelFallback(diffDays, language);
}

function formatRelativeDayLabelFallback(
  diffDays: number,
  language: 'en' | 'ko' | 'ja',
): string {
  if (diffDays === 0) {
    return language === 'ko' ? '오늘' : language === 'ja' ? '今日' : 'today';
  }

  if (diffDays === -1) {
    return language === 'ko'
      ? '어제'
      : language === 'ja'
        ? '昨日'
        : 'yesterday';
  }

  if (diffDays === 1) {
    return language === 'ko'
      ? '내일'
      : language === 'ja'
        ? '明日'
        : 'tomorrow';
  }

  const absoluteDays = Math.abs(diffDays);

  if (language === 'ko') {
    return diffDays > 0 ? `${absoluteDays}일 후` : `${absoluteDays}일 전`;
  }

  if (language === 'ja') {
    return diffDays > 0 ? `${absoluteDays}日後` : `${absoluteDays}日前`;
  }

  return diffDays > 0 ? `in ${absoluteDays} days` : `${absoluteDays} days ago`;
}

function extractSavedAreaLabel(address: string): string {
  const addressParts = address.split(' ').filter(Boolean);

  if (addressParts.length >= 2) {
    return addressParts[1];
  }

  return address;
}

function buildSavedPlaceSubtitle(place: SavedPlace): string {
  return `${extractSavedAreaLabel(place.address)} · ${place.provider.toUpperCase()}`;
}

function buildSavedPlaceMeta(
  place: SavedPlace,
  language: 'en' | 'ko' | 'ja',
): string {
  return `${formatRelativeDayLabel(place.savedAt, language)} · ${formatDateLabel(
    place.savedAt,
  )}`;
}

function buildSearchPlaceCategoryLabel(place: SearchPlace): string | null {
  return place.categoryName ?? place.categoryGroupName ?? null;
}

function normalizeNoteDraft(note: string): string | null {
  const trimmedNote = note.trim();

  return trimmedNote ? trimmedNote : null;
}

function extractErrorMessage(error: unknown, t: Translate): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'SEARCH_PROVIDER_LIMIT_EXCEEDED':
        return t('search_error_limit_exceeded');
      case 'SEARCH_PROVIDER_MISCONFIGURED':
        return t('search_error_misconfigured');
      case 'SEARCH_PROVIDER_UNAVAILABLE':
        return t('search_error_unavailable');
      case 'SEARCH_PROVIDER_ERROR':
        return t('search_error_generic');
      default:
        return error.message;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return t('search_error_generic');
}

function extractExistingPlaceId(details: unknown): string | null {
  if (!details || typeof details !== 'object') {
    return null;
  }

  const existingPlaceId = (details as { existingPlaceId?: unknown })
    .existingPlaceId;

  return typeof existingPlaceId === 'string' ? existingPlaceId : null;
}

function buildProviderPlaceKey(
  place: Pick<SearchPlace, 'provider' | 'providerPlaceId'>,
): string {
  return `${place.provider}:${place.providerPlaceId}`;
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
    paddingTop: 4,
  },
  hero: {
    gap: 6,
  },
  heroTitle: {
    color: journalTokens.color.textStrong,
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  heroDescription: {
    color: journalTokens.color.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  heroMeta: {
    color: journalTokens.color.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  divider: {
    backgroundColor: journalTokens.color.rule,
    height: StyleSheet.hairlineWidth,
  },
  searchComposer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  searchInputShell: {
    backgroundColor: journalTokens.color.pageSurface,
    borderColor: journalTokens.color.ruleStrong,
    borderRadius: journalTokens.radius.soft,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    paddingHorizontal: 14,
  },
  searchComposerInput: {
    color: journalTokens.color.textPrimary,
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: 0,
  },
  searchButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: journalTokens.color.accent,
    borderRadius: journalTokens.radius.soft,
    justifyContent: 'center',
    minWidth: 72,
    paddingHorizontal: 14,
  },
  searchButtonLabel: {
    color: journalTokens.color.inverseText,
    fontSize: 13,
    fontWeight: '600',
  },
  searchDetailBackButton: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    minHeight: 36,
    paddingVertical: 4,
  },
  searchDetailBackSymbol: {
    color: journalTokens.color.textSecondary,
    fontSize: 14,
    lineHeight: 14,
  },
  searchDetailBackLabel: {
    color: journalTokens.color.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  searchDetailHint: {
    color: journalTokens.color.textSecondary,
    fontSize: 13,
    lineHeight: 19,
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
  resultSectionHeader: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  sectionHeaderCopy: {
    flex: 1,
    gap: 3,
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
  sectionDescription: {
    color: journalTokens.color.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  resultCount: {
    color: journalTokens.color.textMuted,
    fontSize: 12,
    lineHeight: 18,
    paddingTop: 4,
  },
  listSection: {
    gap: 0,
  },
  resultGrid: {
    gap: 10,
  },
  resultCard: {
    backgroundColor: journalTokens.color.pageSurface,
    borderColor: journalTokens.color.rule,
    borderRadius: journalTokens.radius.soft,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  resultCardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  resultTitleLine: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  providerBadge: {
    backgroundColor: journalTokens.color.pageBackground,
    borderColor: journalTokens.color.ruleStrong,
    borderRadius: journalTokens.radius.round,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  providerBadgeLabel: {
    color: journalTokens.color.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
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
    alignItems: 'center',
    backgroundColor: journalTokens.color.accentSoft,
    borderColor: journalTokens.color.ruleStrong,
    borderRadius: journalTokens.radius.round,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: 34,
    minWidth: 52,
    paddingHorizontal: 12,
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
  savedTopTabs: {
    flexDirection: 'row',
    gap: 18,
    paddingTop: 2,
  },
  savedTopTabButton: {
    gap: 8,
    paddingBottom: 2,
  },
  savedTopTabLabel: {
    color: journalTokens.color.textMuted,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 26,
  },
  savedTopTabLabelActive: {
    color: journalTokens.color.textStrong,
  },
  savedTopTabIndicator: {
    backgroundColor: journalTokens.color.textStrong,
    borderRadius: journalTokens.radius.round,
    height: 3,
    width: 28,
  },
  savedRecommendedCard: {
    backgroundColor: journalTokens.color.pageSurface,
    borderColor: journalTokens.color.rule,
    borderRadius: journalTokens.radius.medium,
    borderStyle: 'dashed',
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 22,
  },
  savedRecommendedTitle: {
    color: journalTokens.color.textStrong,
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
  },
  savedRecommendedDescription: {
    color: journalTokens.color.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  savedCollectionSection: {
    gap: 12,
  },
  savedCollectionSectionHeader: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  savedCollectionSectionTitle: {
    color: journalTokens.color.textStrong,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  savedCollectionSectionMeta: {
    color: journalTokens.color.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  savedCollectionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  savedCollectionCard: {
    backgroundColor: journalTokens.color.pageSurface,
    borderColor: journalTokens.color.rule,
    borderRadius: journalTokens.radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    flexBasis: '48%',
    flexGrow: 0,
    flexShrink: 0,
    gap: 0,
    minHeight: 168,
    minWidth: 0,
    padding: 12,
  },
  savedCollectionCardActive: {
    backgroundColor: journalTokens.color.pageSubtle,
    borderColor: journalTokens.color.ruleStrong,
    borderWidth: 1,
    shadowColor: '#2C241D',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.08,
    shadowRadius: 18,
  },
  savedCollectionTitle: {
    color: journalTokens.color.textStrong,
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 22,
  },
  savedCollectionCopy: {
    gap: 2,
    paddingTop: 2,
  },
  savedCollectionMeta: {
    color: journalTokens.color.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  savedCollectionCreateCard: {
    alignItems: 'center',
    backgroundColor: journalTokens.color.pageSurface,
    borderColor: journalTokens.color.ruleStrong,
    borderRadius: journalTokens.radius.medium,
    borderStyle: 'dashed',
    borderWidth: 1,
    flexBasis: '48%',
    flexGrow: 0,
    flexShrink: 0,
    gap: 8,
    justifyContent: 'center',
    minHeight: 168,
    minWidth: 0,
    paddingHorizontal: 12,
  },
  savedCollectionCreateCardActive: {
    backgroundColor: journalTokens.color.pageSubtle,
  },
  savedCollectionCreatePanel: {
    backgroundColor: journalTokens.color.pageSurface,
    borderColor: journalTokens.color.rule,
    borderRadius: journalTokens.radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
    padding: 16,
  },
  savedCollectionCreatePanelTitle: {
    color: journalTokens.color.textStrong,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  savedCollectionCreateInput: {
    backgroundColor: journalTokens.color.pageBackground,
    borderColor: journalTokens.color.rule,
    borderRadius: journalTokens.radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    color: journalTokens.color.textPrimary,
    fontSize: 15,
    lineHeight: 20,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  savedCollectionCreateActions: {
    flexDirection: 'row',
    gap: 8,
  },
  savedCollectionCreateSecondaryButton: {
    alignItems: 'center',
    backgroundColor: journalTokens.color.pageBackground,
    borderColor: journalTokens.color.rule,
    borderRadius: journalTokens.radius.round,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 12,
  },
  savedCollectionCreateSecondaryButtonLabel: {
    color: journalTokens.color.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  savedCollectionCreatePrimaryButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: journalTokens.radius.round,
    flex: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 12,
  },
  savedCollectionCreatePrimaryButtonLabel: {
    color: colors.surfaceElevated,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  savedCollectionCreatePlusWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedCollectionCreatePlus: {
    color: journalTokens.color.textSecondary,
    fontSize: 36,
    fontWeight: '300',
    lineHeight: 38,
  },
  savedCollectionCreateLabel: {
    color: journalTokens.color.textSecondary,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  savedFeedHeader: {
    gap: 4,
    paddingTop: 10,
  },
  savedFeedHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  savedFeedHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  savedFeedTitle: {
    color: journalTokens.color.textStrong,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.6,
    lineHeight: 30,
  },
  savedFeedCollectionMeta: {
    color: journalTokens.color.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  savedCollectionDeleteButton: {
    alignItems: 'center',
    backgroundColor: journalTokens.color.pageBackground,
    borderColor: journalTokens.color.rule,
    borderRadius: journalTokens.radius.round,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: 14,
  },
  savedCollectionDeleteButtonLabel: {
    color: journalTokens.color.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  savedFilterBar: {
    gap: 10,
  },
  savedFilterChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  savedOverviewRow: {
    flexDirection: 'row',
    gap: 10,
  },
  savedOverviewCard: {
    backgroundColor: journalTokens.color.pageSurface,
    borderColor: journalTokens.color.rule,
    borderRadius: journalTokens.radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  collectionChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  collectionChip: {
    backgroundColor: journalTokens.color.pageBackground,
    borderColor: journalTokens.color.rule,
    borderRadius: journalTokens.radius.round,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  collectionChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  collectionChipLabel: {
    color: journalTokens.color.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  collectionChipLabelActive: {
    color: colors.surfaceElevated,
  },
  savedOverviewLabel: {
    color: journalTokens.color.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  savedOverviewValue: {
    color: journalTokens.color.textStrong,
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: -0.8,
    lineHeight: 32,
  },
  savedSpotlightCard: {
    backgroundColor: journalTokens.color.pageSurface,
    borderColor: journalTokens.color.rule,
    borderRadius: journalTokens.radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 14,
    overflow: 'hidden',
    padding: 12,
  },
  savedSpotlightCardActive: {
    borderColor: journalTokens.color.accent,
    shadowColor: '#1F1B16',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.08,
    shadowRadius: 18,
  },
  savedSpotlightVisual: {
    borderRadius: journalTokens.radius.medium,
    minHeight: 112,
    overflow: 'hidden',
    padding: 10,
    width: 112,
  },
  savedSpotlightCopy: {
    flex: 1,
    gap: 4,
    justifyContent: 'center',
  },
  savedSpotlightLabel: {
    color: journalTokens.color.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    lineHeight: 16,
    textTransform: 'uppercase',
  },
  savedSpotlightTitle: {
    color: journalTokens.color.textStrong,
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.4,
    lineHeight: 26,
  },
  savedSpotlightAddress: {
    color: journalTokens.color.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  savedSpotlightMeta: {
    color: journalTokens.color.textMuted,
    fontSize: 11,
    lineHeight: 16,
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
  savedFeedList: {
    gap: 18,
  },
  savedFeedCard: {
    backgroundColor: journalTokens.color.pageSurface,
    borderColor: journalTokens.color.rule,
    borderRadius: journalTokens.radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 14,
    padding: 12,
    shadowColor: '#2C241D',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.06,
    shadowRadius: 18,
  },
  savedFeedCardSelected: {
    backgroundColor: journalTokens.color.pageSubtle,
    borderColor: journalTokens.color.ruleStrong,
    shadowOpacity: 0.1,
  },
  savedFeedCardBody: {
    gap: 10,
    paddingHorizontal: 2,
  },
  savedFeedCardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  savedFeedCardTitleWrap: {
    flex: 1,
    gap: 2,
  },
  savedFeedCardTitle: {
    color: journalTokens.color.textStrong,
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.4,
    lineHeight: 26,
  },
  savedFeedCardSubtitle: {
    color: journalTokens.color.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  savedFeedMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  savedFeedFavoritePill: {
    backgroundColor: journalTokens.color.accentSoft,
    borderRadius: journalTokens.radius.round,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  savedFeedFavoritePillLabel: {
    color: journalTokens.color.textPrimary,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
  },
  savedFeedMetaText: {
    color: journalTokens.color.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  savedCardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  savedGridCard: {
    backgroundColor: journalTokens.color.pageSurface,
    borderColor: journalTokens.color.rule,
    borderRadius: journalTokens.radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
    overflow: 'hidden',
    padding: 10,
    width: '47.8%',
  },
  savedGridCardSelected: {
    borderColor: journalTokens.color.accent,
    shadowColor: '#1F1B16',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.06,
    shadowRadius: 16,
  },
  savedCardVisual: {
    borderRadius: journalTokens.radius.soft,
    gap: 12,
    minHeight: 128,
    overflow: 'hidden',
    padding: 12,
  },
  savedCardTopRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  savedProviderPill: {
    borderRadius: journalTokens.radius.round,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  savedProviderPillLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  savedMiniBadge: {
    backgroundColor: 'rgba(251, 250, 247, 0.92)',
    borderRadius: journalTokens.radius.round,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  savedMiniBadgeLabel: {
    color: journalTokens.color.textPrimary,
    fontSize: 10,
    fontWeight: '600',
  },
  savedSelectedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(49, 44, 39, 0.92)',
    borderRadius: journalTokens.radius.round,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  savedSelectedBadgeLabel: {
    color: journalTokens.color.inverseText,
    fontSize: 10,
    fontWeight: '600',
  },
  savedGridCopy: {
    gap: 4,
  },
  savedGridTitle: {
    color: journalTokens.color.textStrong,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  savedGridAddress: {
    color: journalTokens.color.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    minHeight: 34,
  },
  savedGridMeta: {
    color: journalTokens.color.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  savedCollectionPreview: {
    alignSelf: 'stretch',
    gap: 6,
  },
  savedCollectionPreviewRow: {
    flexDirection: 'row',
    gap: 6,
  },
  savedCollectionTile: {
    alignItems: 'center',
    borderRadius: 18,
    flex: 1,
    justifyContent: 'center',
    aspectRatio: 1,
  },
  savedCollectionTileEmpty: {
    backgroundColor: journalTokens.color.pageSubtle,
    borderRadius: 18,
    flex: 1,
    aspectRatio: 1,
  },
  savedCollectionTileGlyph: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.8,
    lineHeight: 28,
  },
  savedThumbnailStrip: {
    flexDirection: 'row',
    gap: 8,
  },
  savedThumbnailTile: {
    alignItems: 'center',
    borderRadius: 18,
    flex: 1,
    height: 134,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  savedThumbnailGlyph: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.8,
    lineHeight: 32,
  },
  savedCoverArt: {
    gap: 8,
    marginTop: 'auto',
  },
  savedCoverArtSpotlight: {
    flex: 1,
    justifyContent: 'center',
    marginTop: 0,
  },
  savedCoverArtRow: {
    flexDirection: 'row',
    gap: 8,
  },
  savedCoverTileColumn: {
    flex: 1,
    gap: 8,
  },
  savedCoverTileLarge: {
    alignItems: 'center',
    borderRadius: 18,
    flex: 1.1,
    justifyContent: 'center',
    minHeight: 72,
  },
  savedCoverTileLargeSpotlight: {
    minHeight: 82,
  },
  savedCoverTileSmall: {
    alignItems: 'center',
    borderRadius: 16,
    justifyContent: 'center',
    minHeight: 32,
  },
  savedCoverTileGlyph: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.8,
    lineHeight: 30,
  },
  savedCoverTileGlyphSmall: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.4,
    lineHeight: 18,
  },
  savedCoverFooter: {
    alignItems: 'flex-start',
    borderRadius: 16,
    justifyContent: 'center',
    minHeight: 26,
    paddingHorizontal: 10,
  },
  savedCoverFooterLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    lineHeight: 14,
  },
  detailCard: {
    borderTopColor: journalTokens.color.rule,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 16,
    paddingTop: 18,
  },
  detailCardElevated: {
    backgroundColor: journalTokens.color.pageSurface,
    borderColor: journalTokens.color.rule,
    borderRadius: journalTokens.radius.medium,
    borderTopWidth: 0,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
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
  detailEyebrow: {
    color: journalTokens.color.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    lineHeight: 16,
    textTransform: 'uppercase',
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
  detailUtilityActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  detailUtilityButton: {
    alignItems: 'center',
    backgroundColor: journalTokens.color.pageSurface,
    borderColor: journalTokens.color.ruleStrong,
    borderRadius: journalTokens.radius.soft,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  detailUtilityButtonPrimary: {
    backgroundColor: journalTokens.color.accentSoft,
    borderColor: journalTokens.color.accent,
  },
  detailUtilityButtonLabel: {
    color: journalTokens.color.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  detailUtilityButtonLabelPrimary: {
    color: journalTokens.color.textStrong,
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
  fieldHint: {
    color: journalTokens.color.textMuted,
    fontSize: 13,
    lineHeight: 18,
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
  emptyCard: {
    backgroundColor: journalTokens.color.pageSurface,
    borderColor: journalTokens.color.rule,
    borderRadius: journalTokens.radius.soft,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonDisabledSurface: {
    opacity: 0.45,
  },
});
