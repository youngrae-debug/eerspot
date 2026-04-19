import type { RequestOptions } from '../../../shared/api/http';
import type { SearchPlace } from '../../places/types';

type AuthorizedRequest = <T>(
  path: string,
  options?: RequestOptions,
) => Promise<T>;

const LINK_DISCOVERY_TIMEOUT_MS = 60000;

export type LinkDiscoverMatchConfidence = 'high' | 'medium' | 'low';

export type LinkDiscoverMatchReason =
  | {
      type: 'query';
      query: string;
    }
  | {
      type: 'location';
      location: string;
    }
  | {
      type: 'titleTokens';
      tokens: string[];
    }
  | {
      type: 'searchRank';
      rank: number;
    };

export type LinkDiscoverItem = SearchPlace & {
  locationHint: string | null;
  matchedQuery: string;
  matchConfidence: LinkDiscoverMatchConfidence;
  matchReasons: LinkDiscoverMatchReason[];
};

export type LinkDiscoverAnalysis = {
  detectedNameCount: number;
  kind: 'single' | 'multi';
  matchedItemCount: number;
  status: 'ready' | 'partial';
};

export type LinkDiscoverResult = {
  analysis: LinkDiscoverAnalysis;
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
    timeoutMs: LINK_DISCOVERY_TIMEOUT_MS,
  });
}
