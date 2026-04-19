export type PlaceProvider = 'naver' | 'kakao' | 'google';

export type PlaceSearchResult = {
  provider: PlaceProvider;
  providerPlaceId: string;
  name: string;
  address: string;
  roadAddress?: string | null;
  categoryName?: string | null;
  categoryGroupName?: string | null;
  phone?: string | null;
  lat: number;
  lng: number;
  mapUrl?: string | null;
};

export type SavedPlaceRecord = PlaceSearchResult & {
  id: string;
  userId: string;
  note: string | null;
  isFavorite: boolean;
  savedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type PlaceCollectionRecord = {
  id: string;
  userId: string;
  name: string;
  placeIds: string[];
  createdAt: string;
  updatedAt: string;
};
