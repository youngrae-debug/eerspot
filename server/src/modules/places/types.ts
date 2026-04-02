export type PlaceProvider = 'naver' | 'kakao' | 'google';

export type PlaceSearchResult = {
  provider: PlaceProvider;
  providerPlaceId: string;
  name: string;
  address: string;
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
