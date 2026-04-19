export type DiscoverIncomingLinkRequest = {
  key: number;
  url: string;
};

export function extractDiscoverUrlFromAppLink(value: string): string | null {
  try {
    const parsedUrl = new URL(value);

    if (parsedUrl.protocol.toLowerCase() !== 'eerspot:') {
      return null;
    }

    const normalizedHost = parsedUrl.hostname.toLowerCase();
    const normalizedPath = parsedUrl.pathname.replace(/\/+$/, '').toLowerCase();
    const isDiscoverRoute =
      normalizedHost === 'discover' ||
      normalizedPath === '/discover' ||
      normalizedPath === 'discover';

    if (!isDiscoverRoute) {
      return null;
    }

    const nestedUrl = parsedUrl.searchParams.get('url');

    return nestedUrl?.trim() ? nestedUrl.trim() : null;
  } catch {
    return null;
  }
}
