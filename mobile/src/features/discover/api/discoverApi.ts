import type { RequestOptions } from '../../../shared/api/http';
import type { SearchPlace } from '../../places/types';

type AuthorizedRequest = <T>(
  path: string,
  options?: RequestOptions,
) => Promise<T>;

export type LinkDiscoverItem = SearchPlace & {
  locationHint: string | null;
  matchedQuery: string;
};

export type LinkDiscoverResult = {
  items: LinkDiscoverItem[];
  page: {
    contentPreview: string;
    description: string | null;
    locationHints: string[];
    title: string | null;
    url: string;
  };
  queryHints: string[];
};

export async function discoverPlacesFromLink(
  authorizedRequest: AuthorizedRequest,
  url: string,
): Promise<LinkDiscoverResult> {
  return authorizedRequest('/places/discover-link', {
    method: 'POST',
    body: {
      url,
    },
  });
}
