export type PlaceProvider = 'naver' | 'kakao' | 'google';

export type SearchPlace = {
  provider: PlaceProvider;
  providerPlaceId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  mapUrl?: string | null;
};

export type SavedPlace = SearchPlace & {
  id: string;
  note: string | null;
  isFavorite: boolean;
  savedAt: string;
  createdAt: string;
  updatedAt: string;
};
