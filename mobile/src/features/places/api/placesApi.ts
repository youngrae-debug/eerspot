import type { RequestOptions } from '../../../shared/api/http';

import type { SavedPlace, SearchPlace } from '../types';

type AuthorizedRequest = <T>(
  path: string,
  options?: RequestOptions,
) => Promise<T>;

export async function searchPlaces(
  authorizedRequest: AuthorizedRequest,
  query: string,
): Promise<SearchPlace[]> {
  const data = await authorizedRequest<{ items: SearchPlace[] }>(
    `/places/search?query=${encodeURIComponent(query)}`,
  );

  return data.items;
}

export async function savePlace(
  authorizedRequest: AuthorizedRequest,
  place: SearchPlace,
): Promise<{ id: string }> {
  return authorizedRequest<{ id: string }>('/places', {
    method: 'POST',
    body: place,
  });
}

export async function listPlaces(
  authorizedRequest: AuthorizedRequest,
): Promise<{
  items: SavedPlace[];
  pageInfo: {
    nextCursor: string | null;
    hasNext: boolean;
  };
}> {
  return authorizedRequest('/places');
}

export async function getPlace(
  authorizedRequest: AuthorizedRequest,
  placeId: string,
): Promise<SavedPlace> {
  return authorizedRequest(`/places/${placeId}`);
}
