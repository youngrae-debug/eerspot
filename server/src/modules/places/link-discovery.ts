import { AppError } from '../../lib/http/errors.js';

import type { ImageOcrClient } from './image-ocr.js';
import type { PlaceSearchClient } from './search-client.js';
import type { PlaceSearchResult } from './types.js';

type LocationHint = {
  label: string;
  patterns: string[];
};

type CategoryHint = {
  label: string;
  patterns: string[];
};

type PageSummary = {
  contentPreview: string;
  description: string | null;
  imageUrls: string[];
  locationHints: string[];
  title: string | null;
  url: string;
};

export type LinkDiscoveryItem = PlaceSearchResult & {
  locationHint: string | null;
  matchedQuery: string;
};

export type LinkDiscoveryResult = {
  items: LinkDiscoveryItem[];
  page: PageSummary;
  queryHints: string[];
};

type ExplicitQueryHint = {
  score: number;
  value: string;
};

const LOCATION_HINTS: LocationHint[] = [
  { label: '성수', patterns: ['성수', 'seongsu'] },
  { label: '을지로', patterns: ['을지로', 'euljiro'] },
  { label: '연남', patterns: ['연남', 'yeonnam'] },
  { label: '한남', patterns: ['한남', 'hannam'] },
  { label: '부산', patterns: ['부산', 'busan'] },
  { label: '서울', patterns: ['서울', 'seoul'] },
  { label: '서울숲', patterns: ['서울숲', 'seoul forest'] },
  { label: '홍대', patterns: ['홍대', 'hongdae'] },
  { label: '망원', patterns: ['망원', 'mangwon'] },
  { label: '이태원', patterns: ['이태원', 'itaewon'] },
  { label: '종로', patterns: ['종로', 'jongno'] },
  { label: '삼청', patterns: ['삼청', 'samcheong'] },
];

const CATEGORY_HINTS: CategoryHint[] = [
  { label: '카페', patterns: ['카페', 'cafe', 'coffee'] },
  { label: '브런치', patterns: ['브런치', 'brunch'] },
  { label: '전시', patterns: ['전시', 'gallery', 'exhibition', 'popup'] },
  { label: '서점', patterns: ['서점', 'bookstore', 'book shop', 'books'] },
  { label: '식당', patterns: ['식당', 'restaurant', 'dinner', 'lunch'] },
  { label: '맛집', patterns: ['맛집', 'food', 'restaurant'] },
  { label: '빕 구르망', patterns: ['빕 구르망', 'bib gourmand'] },
  { label: '호프', patterns: ['호프', 'bar', 'beer', 'pub'] },
];

const ADDRESS_PATTERN = /서울\s+[가-힣A-Za-z0-9.-]+\s+(?:구|동|로|길|가)[^<\n]{0,20}/g;
const PAGE_TIMEOUT_MS = 5000;
const MAX_RESULTS = 6;
const MAX_PAGE_IMAGE_URLS = 8;
const MAX_GENERIC_OCR_IMAGES = 4;
const MAX_INSTAGRAM_OCR_IMAGES = 10;
const MAX_SEARCH_QUERY_HINTS = 12;
const MAX_VISIBLE_QUERY_HINTS = 80;

export class LinkPlaceDiscoveryService {
  constructor(
    private readonly primarySearchClient: PlaceSearchClient,
    private readonly fallbackSearchClient: PlaceSearchClient,
    private readonly pageFetchImpl: typeof fetch = fetch,
    private readonly imageOcrClient: ImageOcrClient | null = null,
  ) {}

  async analyze(url: string): Promise<LinkDiscoveryResult> {
    const normalizedUrl = normalizeUrl(url);
    const html = await this.fetchPage(normalizedUrl);
    const instagramEmbedHtml = await this.fetchInstagramEmbedPage(normalizedUrl);
    const pageSummary = summarizePage(html, normalizedUrl, instagramEmbedHtml);
    const explicitQueryHints = extractExplicitQueryHints(pageSummary);
    const textQueryHints = buildQueryHints(pageSummary, [], explicitQueryHints);
    const imageQueryHints = await this.extractImageQueryHints(pageSummary);
    const queryHints = buildQueryHints(
      pageSummary,
      imageQueryHints,
      explicitQueryHints,
    );

    if (queryHints.length === 0) {
      throw new AppError(
        422,
        'LINK_ANALYSIS_FAILED',
        'could not infer place hints from this link',
      );
    }

    const items = await this.searchCandidates(
      pageSummary,
      queryHints.slice(0, MAX_SEARCH_QUERY_HINTS),
    );
    const visibleQueryHints =
      items.length > 0
        ? uniqueCompact(items.map(item => item.matchedQuery))
        : explicitQueryHints.length > 0
          ? explicitQueryHints
        : imageQueryHints.length > 0
          ? imageQueryHints
          : textQueryHints;

    return {
      items,
      page: pageSummary,
      queryHints: visibleQueryHints,
    };
  }

  private async extractImageQueryHints(pageSummary: PageSummary): Promise<string[]> {
    if (
      !this.imageOcrClient ||
      pageSummary.imageUrls.length === 0 ||
      !shouldAttemptImageOcr(pageSummary.url)
    ) {
      return [];
    }

    const imageQueryHints: string[] = [];

    for (const imageUrl of selectImageUrlsForOcr(pageSummary)) {
      try {
        const nextHints = await this.imageOcrClient.extractHints(imageUrl);
        imageQueryHints.push(...nextHints);
      } catch {
        // Keep trying the remaining slides so one OCR miss does not block all hints.
      }

      if (uniqueCompact(imageQueryHints).length >= MAX_VISIBLE_QUERY_HINTS) {
        break;
      }
    }

    return uniqueCompact(imageQueryHints).slice(0, MAX_VISIBLE_QUERY_HINTS);
  }

  private async fetchPage(url: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PAGE_TIMEOUT_MS);

    try {
      const response = await this.pageFetchImpl(url, {
        redirect: 'follow',
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new AppError(
          502,
          'LINK_ANALYSIS_FAILED',
          'failed to fetch the provided link',
          {
            status: response.status,
          },
        );
      }

      const html = await response.text();

      if (!html.trim()) {
        throw new AppError(
          422,
          'LINK_ANALYSIS_FAILED',
          'the provided link did not return readable text',
        );
      }

      return html;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        502,
        'LINK_ANALYSIS_FAILED',
        'failed to analyze the provided link',
        {
          cause:
            error instanceof Error && error.message
              ? error.message
              : 'unknown fetch error',
        },
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async fetchInstagramEmbedPage(url: string): Promise<string | null> {
    if (!shouldFetchInstagramEmbed(url)) {
      return null;
    }

    try {
      return await this.fetchPage(buildInstagramEmbedUrl(url));
    } catch {
      return null;
    }
  }

  private async searchCandidates(
    pageSummary: PageSummary,
    queryHints: string[],
  ): Promise<LinkDiscoveryItem[]> {
    const titleTokens = tokenize(pageSummary.title);
    const locationHints = pageSummary.locationHints.map(value => value.toLowerCase());
    const candidates = new Map<
      string,
      LinkDiscoveryItem & {
        score: number;
      }
    >();

    for (const [queryIndex, query] of queryHints.entries()) {
      const results = await this.searchWithFallback(query);

      results.slice(0, 4).forEach((result, resultIndex) => {
        const key = `${result.provider}:${result.providerPlaceId}`;
        const haystack = `${result.name} ${result.address}`.toLowerCase();
        const matchedLocationHint =
          pageSummary.locationHints.find(locationHint => {
            return haystack.includes(locationHint.toLowerCase());
          }) ?? null;
        const titleTokenHits = titleTokens.filter(token => haystack.includes(token))
          .length;
        const score =
          100 -
          queryIndex * 12 -
          resultIndex * 4 +
          titleTokenHits * 8 +
          (matchedLocationHint ? 10 : 0) +
          locationHints.filter(locationHint => haystack.includes(locationHint)).length;

        const currentCandidate = candidates.get(key);

        if (!currentCandidate || score > currentCandidate.score) {
          candidates.set(key, {
            ...result,
            locationHint: matchedLocationHint,
            matchedQuery: query,
            score,
          });
        }
      });
    }

    return [...candidates.values()]
      .sort((left, right) => right.score - left.score)
      .slice(0, MAX_RESULTS)
      .map(({ score: _score, ...item }) => item);
  }

  private async searchWithFallback(query: string): Promise<PlaceSearchResult[]> {
    try {
      const primaryResults = await this.primarySearchClient.search(query);

      if (primaryResults.length > 0) {
        return primaryResults;
      }
    } catch {
      // Fall through to the static catalog so Discover keeps working locally.
    }

    return this.fallbackSearchClient.search(query);
  }
}

function summarizePage(
  html: string,
  url: string,
  instagramEmbedHtml: string | null = null,
): PageSummary {
  const rawTitle =
    firstNonEmpty([
      extractMetaContent(html, 'og:title'),
      extractMetaContent(html, 'twitter:title'),
      extractTitle(html),
    ]) ?? null;
  const rawDescription =
    firstNonEmpty([
      extractMetaContent(html, 'description'),
      extractMetaContent(html, 'og:description'),
      extractMetaContent(html, 'twitter:description'),
    ]) ?? null;
  const title = cleanPageTitle(rawTitle, url);
  const description = cleanPageDescription(rawDescription, url);
  const maxImageUrls = shouldFetchInstagramEmbed(url)
    ? MAX_INSTAGRAM_OCR_IMAGES
    : MAX_PAGE_IMAGE_URLS;
  const imageUrls = uniqueCompact([
    ...extractInstagramSidecarImageUrls(instagramEmbedHtml),
    ...extractPageImageUrls(html, url),
  ]).slice(0, maxImageUrls);
  const bodyText = normalizeWhitespace(stripHtml(html));
  const contentPreview = buildContentPreview({
    bodyText,
    description,
    title,
    url,
  });
  const locationHints = extractLocationHints(
    [title, description, bodyText].filter(Boolean).join(' '),
  );

  return {
    contentPreview,
    description,
    imageUrls,
    locationHints,
    title,
    url,
  };
}

function buildQueryHints(
  pageSummary: PageSummary,
  imageQueryHints: string[],
  explicitQueryHints: string[],
): string[] {
  const titleBase = compactTitleQuery(cleanTitle(pageSummary.title));
  const categoryHints = inferCategoryHints(
    [titleBase, pageSummary.description, pageSummary.contentPreview]
      .filter(Boolean)
      .join(' '),
  );
  const imageQueries = imageQueryHints.flatMap(imageHint => {
    return [
      imageHint,
      ...pageSummary.locationHints.slice(0, 2).map(locationHint => {
        return `${locationHint} ${imageHint}`;
      }),
    ];
  });
  const nextQueries = uniqueCompact([
    ...explicitQueryHints,
    ...imageQueries,
    titleBase,
    ...pageSummary.locationHints.flatMap(locationHint => {
      return [
        titleBase ? `${titleBase} ${locationHint}` : null,
        ...categoryHints.map(categoryHint => `${locationHint} ${categoryHint}`),
      ];
    }),
    ...categoryHints,
  ]);

  return nextQueries.slice(0, MAX_VISIBLE_QUERY_HINTS);
}

function extractExplicitQueryHints(pageSummary: PageSummary): string[] {
  const rankedHints = uniqueExplicitHints([
    ...extractInstagramMarkerHints(pageSummary.title, 120),
    ...extractInstagramMarkerHints(pageSummary.description, 90),
    ...extractInstagramMarkerHints(pageSummary.contentPreview, 60),
    ...extractInstagramNarrativeHints(pageSummary.title, 110),
    ...extractInstagramNarrativeHints(pageSummary.description, 85),
    ...extractInstagramNarrativeHints(pageSummary.contentPreview, 55),
  ]);

  return rankedHints
    .sort((left, right) => right.score - left.score)
    .map(hint => hint.value)
    .slice(0, 8);
}

function normalizeUrl(value: string): string {
  let normalizedUrl: URL;

  try {
    normalizedUrl = new URL(value.trim());
  } catch {
    throw new AppError(400, 'VALIDATION_ERROR', 'url must be a valid http link');
  }

  if (
    normalizedUrl.protocol !== 'https:' &&
    normalizedUrl.protocol !== 'http:'
  ) {
    throw new AppError(400, 'VALIDATION_ERROR', 'url must be a valid http link');
  }

  return normalizedUrl.toString();
}

function extractTitle(html: string): string | null {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);

  return match ? decodeHtmlEntities(normalizeWhitespace(match[1])) : null;
}

function extractMetaContent(html: string, name: string): string | null {
  return extractMetaContents(html, name)[0] ?? null;
}

function extractMetaContents(html: string, name: string): string[] {
  const escapedName = escapeRegExp(name);
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:name|property)=["']${escapedName}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      'gi',
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${escapedName}["'][^>]*>`,
      'gi',
    ),
  ];

  return uniqueCompact(
    patterns.flatMap(pattern => {
      return [...html.matchAll(pattern)].map(match => {
        return decodeHtmlEntities(normalizeWhitespace(match[1] ?? ''));
      });
    }),
  );
}

function extractPageImageUrls(html: string, pageUrl: string): string[] {
  return uniqueCompact([
    ...extractMetaImageUrls(html, pageUrl),
    ...extractInlineImageUrls(html, pageUrl),
  ]);
}

function extractMetaImageUrls(html: string, pageUrl: string): string[] {
  return uniqueCompact(
    [
      ...extractMetaContents(html, 'og:image'),
      ...extractMetaContents(html, 'og:image:url'),
      ...extractMetaContents(html, 'twitter:image'),
    ]
      .map(imageUrl => resolveImageUrl(imageUrl, pageUrl))
      .filter(isNonEmptyString)
      .filter(isLikelyContentImageUrl),
  );
}

function extractInlineImageUrls(html: string, pageUrl: string): string[] {
  const attributePatterns = [
    /<img[^>]+(?:src|data-src|data-lazy-src|data-original)=["']([^"']+)["'][^>]*>/gi,
    /<img[^>]+(?:srcset|data-srcset)=["']([^"']+)["'][^>]*>/gi,
  ];

  return uniqueCompact(
    attributePatterns.flatMap(pattern => {
      return [...html.matchAll(pattern)]
        .map(match => {
          const rawValue = normalizeWhitespace(match[1] ?? '');

          return pattern.source.includes('srcset')
            ? extractFirstSrcsetUrl(rawValue)
            : rawValue;
        })
        .map(imageUrl => resolveImageUrl(imageUrl, pageUrl))
        .filter(isNonEmptyString)
        .filter(isLikelyContentImageUrl);
    }),
  );
}

function stripHtml(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  );
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_match, hexValue: string) => {
      return safeCodePointToString(Number.parseInt(hexValue, 16));
    })
    .replace(/&#([0-9]+);/g, (_match, decimalValue: string) => {
      return safeCodePointToString(Number.parseInt(decimalValue, 10));
    })
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function buildContentPreview(input: {
  bodyText: string;
  description: string | null;
  title: string | null;
  url: string;
}): string {
  if (input.description) {
    return input.description.slice(0, 260);
  }

  const cleanedBodyText = cleanBodyText(input.bodyText, input.url);

  if (cleanedBodyText) {
    return cleanedBodyText.slice(0, 260);
  }

  return input.title ?? '';
}

function extractLocationHints(source: string): string[] {
  const normalizedSource = source.toLowerCase();
  const locationHints = LOCATION_HINTS.filter(locationHint => {
    return locationHint.patterns.some(pattern =>
      normalizedSource.includes(pattern.toLowerCase()),
    );
  }).map(locationHint => locationHint.label);
  const addressHints = [...source.matchAll(ADDRESS_PATTERN)].map(match => {
    return normalizeWhitespace(match[0]);
  });

  return uniqueCompact([...locationHints, ...addressHints]).slice(0, 4);
}

function inferCategoryHints(source: string): string[] {
  const normalizedSource = source.toLowerCase();

  return CATEGORY_HINTS.filter(categoryHint => {
    return categoryHint.patterns.some(pattern =>
      normalizedSource.includes(pattern.toLowerCase()),
    );
  }).map(categoryHint => categoryHint.label);
}

function cleanTitle(title: string | null): string | null {
  if (!title) {
    return null;
  }

  const cleanedTitle = normalizeWhitespace(title)
    .split(/\s+[|·\-:]\s+/)
    .map(part => part.trim())
    .find(part => part.length >= 2);

  return cleanedTitle ?? null;
}

function cleanPageTitle(title: string | null, url: string): string | null {
  if (!title) {
    return null;
  }

  const hostname = getHostname(url);

  if (hostname.includes('instagram.com')) {
    const instagramCaptionMatch = / on Instagram:\s*"?([\s\S]+?)"?$/i.exec(title);

    if (instagramCaptionMatch?.[1]) {
      return normalizeWhitespace(
        stripInstagramHashtagTail(
          trimTrailingQuotePeriod(stripWrappingQuotes(instagramCaptionMatch[1])),
        ),
      );
    }

    return normalizeWhitespace(
      stripInstagramHashtagTail(
        trimTrailingQuotePeriod(
          title.replace(/\s*\([^)]*\)\s*•\s*Instagram photos and videos$/i, ''),
        ),
      ),
    );
  }

  return normalizeWhitespace(trimTrailingQuotePeriod(stripWrappingQuotes(title)));
}

function cleanPageDescription(
  description: string | null,
  url: string,
): string | null {
  if (!description) {
    return null;
  }

  const hostname = getHostname(url);

  if (hostname.includes('instagram.com')) {
    const cleanedInstagramDescription = description
      .replace(
        /^\d[\d,]*\s+likes?,\s*\d[\d,]*\s+comments?\s*-\s*[^:]+:\s*/i,
        '',
      )
      .replace(/["']?\.\s*$/, '')
      .trim();

    return normalizeWhitespace(
      stripInstagramHashtagTail(
        trimTrailingQuotePeriod(stripWrappingQuotes(cleanedInstagramDescription)),
      ),
    );
  }

  return normalizeWhitespace(
    trimTrailingQuotePeriod(stripWrappingQuotes(description)),
  );
}

function cleanBodyText(bodyText: string, url: string): string {
  const hostname = getHostname(url);

  if (hostname.includes('instagram.com')) {
    return '';
  }

  return bodyText;
}

function extractInstagramMarkerHints(
  value: string | null,
  score: number,
): ExplicitQueryHint[] {
  if (!value) {
    return [];
  }

  const normalizedValue = normalizeWhitespace(value);
  const hints = [...normalizedValue.matchAll(/📌\s*([^📍🕐⌨❌@#\[\]\n]{2,40})/gu)]
    .map(match => normalizeExplicitHint(match[1] ?? ''))
    .filter(Boolean)
    .filter(isLikelyExplicitPlaceHint)
    .map(hint => {
      return {
        score,
        value: hint,
      };
    });

  return hints;
}

function extractInstagramNarrativeHints(
  value: string | null,
  score: number,
): ExplicitQueryHint[] {
  if (!value) {
    return [];
  }

  const normalizedValue = normalizeWhitespace(value);
  const directPatterns = [
    /([가-힣A-Za-z0-9&]{2,20})\s+(?:다녀왔습니다|다녀왔어요|다녀왔음|방문했습니다|방문했어요|가봤습니다|가봤어요)/gu,
    /([가-힣A-Za-z0-9&]{2,20})\s+입니다(?:\s|$)/gu,
  ];
  const descriptorPatterns = [
    /(?:맛집|카페|식당|고깃집|술집|막창집|베이커리|바)\s+([가-힣A-Za-z0-9&]{2,20})(?:\s|$)/gu,
  ];

  return uniqueExplicitHints([
    ...extractNarrativePatternHints(normalizedValue, directPatterns, score),
    ...extractNarrativePatternHints(normalizedValue, descriptorPatterns, score - 8),
  ]);
}

function extractNarrativePatternHints(
  value: string,
  patterns: RegExp[],
  score: number,
): ExplicitQueryHint[] {
  return patterns.flatMap(pattern => {
    return [...value.matchAll(pattern)]
      .map(match => normalizeNarrativeHint(match[1] ?? ''))
      .filter(Boolean)
      .filter(isLikelyNarrativePlaceHint)
      .map(hint => {
        return {
          score,
          value: hint,
        };
      });
  });
}

function normalizeExplicitHint(value: string): string {
  return normalizeWhitespace(value)
    .replace(/^[\s:.,-]+|[\s:.,-]+$/g, '')
    .replace(/\s+(공식\s+)?인스타(?:그램)?$/iu, '')
    .replace(/\s+카페$/u, '')
    .trim();
}

function normalizeNarrativeHint(value: string): string {
  return normalizeWhitespace(value)
    .replace(/^[\s:.,!?\-[\]()]+|[\s:.,!?\-[\]()]+$/g, '')
    .replace(/[님씨]$/u, '')
    .trim();
}

function isLikelyExplicitPlaceHint(value: string): boolean {
  if (value.length < 2 || value.length > 24) {
    return false;
  }

  if (/[0-9]{2,}/.test(value)) {
    return false;
  }

  const loweredValue = value.toLowerCase();

  return ![
    '인스타그램',
    '요즘 핫한',
    '판매처',
    '버터떡',
    '유료광고포함',
  ].some(fragment => loweredValue.includes(fragment));
}

function isLikelyNarrativePlaceHint(value: string): boolean {
  if (value.length < 2 || value.length > 20) {
    return false;
  }

  if (/^\d+$/.test(value) || /\s/.test(value)) {
    return false;
  }

  const loweredValue = value.toLowerCase();

  if (
    [
      '곳',
      '집',
      '처음',
      '공간',
      '구성이',
      '느낌',
      '메뉴',
      '포인트',
      '정석',
      '서비스',
      '이벤트',
    ].includes(loweredValue)
  ) {
    return false;
  }

  return ![
    '인스타그램',
    '서비스',
    '이벤트',
    '포인트',
    '막창으로',
    '삼겹살',
  ].some(fragment => loweredValue.includes(fragment));
}

function tokenize(value: string | null): string[] {
  if (!value) {
    return [];
  }

  return uniqueCompact(
    value
      .toLowerCase()
      .split(/[^a-z0-9가-힣]+/)
      .filter(token => token.length >= 2),
  );
}

function firstNonEmpty(values: Array<string | null>): string | null {
  return values.find(value => Boolean(value && value.trim())) ?? null;
}

function uniqueCompact(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())))];
}

function uniqueExplicitHints(values: ExplicitQueryHint[]): ExplicitQueryHint[] {
  const map = new Map<string, ExplicitQueryHint>();

  for (const value of values) {
    const currentValue = map.get(value.value);

    if (!currentValue || value.score > currentValue.score) {
      map.set(value.value, value);
    }
  }

  return [...map.values()];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function safeCodePointToString(value: number): string {
  if (!Number.isFinite(value) || value < 0 || value > 0x10ffff) {
    return '';
  }

  try {
    return String.fromCodePoint(value);
  } catch {
    return '';
  }
}

function stripWrappingQuotes(value: string): string {
  return value.replace(/^["']+|["']+$/g, '');
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function trimTrailingQuotePeriod(value: string): string {
  return value.replace(/["']?\.\s*$/, '').trim();
}

function shouldAttemptImageOcr(url: string): boolean {
  const hostname = getHostname(url);

  return Boolean(hostname);
}

function shouldFetchInstagramEmbed(url: string): boolean {
  const hostname = getHostname(url);

  return hostname.includes('instagram.com');
}

function buildInstagramEmbedUrl(url: string): string {
  const normalizedUrl = new URL(url);
  const pathname = normalizedUrl.pathname.replace(/\/$/, '');

  return `${normalizedUrl.origin}${pathname}/embed/captioned/`;
}

function extractInstagramSidecarImageUrls(html: string | null): string[] {
  if (!html) {
    return [];
  }

  const sidecarIndex = html.indexOf('edge_sidecar_to_children');

  if (sidecarIndex < 0) {
    return [];
  }

  const relevantSlice = html.slice(sidecarIndex, sidecarIndex + 200_000);
  const marker = '\\"display_url\\":\\"';

  return uniqueCompact(
    relevantSlice
      .split(marker)
      .slice(1)
      .map(segment => segment.split('\\"')[0] ?? '')
      .map(value => value.replace(/\\+\//g, '/'))
      .map(value => decodeHtmlEntities(value))
      .filter(value => {
        return value.includes('cdninstagram.com') && value.includes('/t51.82787-15/');
      }),
  );
}

function selectImageUrlsForOcr(pageSummary: PageSummary): string[] {
  if (shouldFetchInstagramEmbed(pageSummary.url) && pageSummary.imageUrls.length > 1) {
    return uniqueCompact([
      ...pageSummary.imageUrls.slice(1, MAX_INSTAGRAM_OCR_IMAGES),
      pageSummary.imageUrls[0],
    ]);
  }

  return pageSummary.imageUrls.slice(0, MAX_GENERIC_OCR_IMAGES);
}

function extractFirstSrcsetUrl(value: string): string {
  return normalizeWhitespace(value.split(',')[0]?.trim().split(/\s+/)[0] ?? '');
}

function resolveImageUrl(value: string, pageUrl: string): string | null {
  if (!value || value.startsWith('data:')) {
    return null;
  }

  try {
    const nextUrl = new URL(value, pageUrl);

    if (nextUrl.protocol !== 'http:' && nextUrl.protocol !== 'https:') {
      return null;
    }

    return nextUrl.toString();
  } catch {
    return null;
  }
}

function isLikelyContentImageUrl(value: string): boolean {
  const normalizedValue = value.toLowerCase();

  if (/\.(svg|ico)(?:$|[?#])/i.test(normalizedValue)) {
    return false;
  }

  return ![
    'avatar',
    'emoji',
    'favicon',
    'icon',
    'logo',
    'profile',
    'sprite',
  ].some(fragment => normalizedValue.includes(fragment));
}

function isNonEmptyString(value: string | null): value is string {
  return typeof value === 'string' && value.length > 0;
}

function stripInstagramHashtagTail(value: string): string {
  return value
    .replace(/\s+-\s+#.*$/u, '')
    .replace(/\s+#\S.*$/u, '')
    .trim();
}

function compactTitleQuery(value: string | null): string | null {
  if (!value) {
    return null;
  }

  if (value.length > 40) {
    return null;
  }

  return value;
}
