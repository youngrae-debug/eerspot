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

export type LinkDiscoveryMatchConfidence = 'high' | 'medium' | 'low';

export type LinkDiscoveryMatchReason =
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

export type LinkDiscoveryItem = PlaceSearchResult & {
  locationHint: string | null;
  matchedQuery: string;
  matchConfidence: LinkDiscoveryMatchConfidence;
  matchReasons: LinkDiscoveryMatchReason[];
};

export type LinkDiscoveryAnalysisKind = 'single' | 'multi';
export type LinkDiscoveryAnalysisStatus = 'ready' | 'partial';

export type LinkDiscoveryAnalysis = {
  detectedNameCount: number;
  kind: LinkDiscoveryAnalysisKind;
  matchedItemCount: number;
  status: LinkDiscoveryAnalysisStatus;
};

export type LinkDiscoveryResult = {
  analysis: LinkDiscoveryAnalysis;
  items: LinkDiscoveryItem[];
  page: PageSummary;
  queryHints: string[];
};

type ExplicitQueryHint = {
  score: number;
  value: string;
};

type ExplicitVenueConstraint = {
  address: string;
  name: string;
};

const LOCATION_HINTS: LocationHint[] = [
  { label: '성수', patterns: ['성수', 'seongsu'] },
  { label: '을지로', patterns: ['을지로', 'euljiro'] },
  { label: '연남', patterns: ['연남', 'yeonnam'] },
  { label: '한남', patterns: ['한남', 'hannam'] },
  { label: '전주', patterns: ['전주', 'jeonju'] },
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

const KOREAN_METRO_AREAS = [
  '서울',
  '부산',
  '대구',
  '인천',
  '광주',
  '대전',
  '울산',
  '세종',
] as const;
const KOREAN_PROVINCES = [
  '경기',
  '강원',
  '충북',
  '충남',
  '전북',
  '전남',
  '경북',
  '경남',
  '제주',
] as const;
const KOREAN_SPECIAL_PROVINCES = [
  '강원특별자치도',
  '전북특별자치도',
  '제주특별자치도',
] as const;
const KOREAN_REGION_PREFIX_PATTERN = [
  ...KOREAN_SPECIAL_PROVINCES,
  ...KOREAN_METRO_AREAS,
  ...KOREAN_PROVINCES,
].join('|');
const ADDRESS_PATTERN = /서울\s+[가-힣A-Za-z0-9.-]+\s+(?:구|동|로|길|가)[^<\n]{0,20}/g;
const KOREAN_ADDRESS_PATTERN = new RegExp(
  `(?:${KOREAN_REGION_PREFIX_PATTERN})(?:특별시|광역시|특별자치도|도|시)?\\s+[가-힣A-Za-z0-9.-]+(?:시|군|구)\\s+[가-힣A-Za-z0-9.-]+(?:구|읍|면|동|로|길|가)[^<\\n]{0,24}`,
  'gu',
);
const PAGE_TIMEOUT_MS = 5000;
const MAX_RESULTS = 6;
const MAX_PAGE_IMAGE_URLS = 8;
const MAX_GENERIC_OCR_IMAGES = 4;
const MAX_INSTAGRAM_OCR_IMAGES = 10;
const MAX_SEARCH_QUERY_HINTS = 12;
const MAX_VISIBLE_QUERY_HINTS = 80;
const MULTI_PLACE_KEYWORDS = [
  '가야 할',
  '모아왔',
  '모아봤',
  '모아봤당',
  '모아봤어요',
  '모음',
  '리스트',
  '스팟',
  '총정리',
  '추천',
  '코스',
  '투어',
];
const MULTI_PLACE_CATEGORY_KEYWORDS = [
  '맛집',
  '카페',
  '야장',
  '술집',
  '명소',
  '놀거리',
];

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
    const explicitVenueConstraints = extractExplicitVenueConstraints(pageSummary);
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
      explicitVenueConstraints,
    );
    const multiPlaceSignals = detectMultiPlaceSignals(pageSummary, explicitQueryHints);
    const shouldSuppressAmbiguousItems =
      multiPlaceSignals.isLikelyMultiPlacePost &&
      getHostname(pageSummary.url).includes('instagram.com') &&
      multiPlaceSignals.detectedNameCount <= 1 &&
      items.length <= 1;
    const visibleItems = shouldSuppressAmbiguousItems ? [] : items;
    const visibleQueryHints = shouldSuppressAmbiguousItems
      ? []
      : visibleItems.length > 0
        ? uniqueCompact([
            ...visibleItems.map(item => item.matchedQuery),
            ...explicitQueryHints,
            ...imageQueryHints,
            ...textQueryHints,
          ])
        : explicitQueryHints.length > 0
          ? explicitQueryHints
          : imageQueryHints.length > 0
            ? imageQueryHints
            : textQueryHints;
    const presentableQueryHints = visibleQueryHints.filter(isPresentableQueryHint);
    const analysis = buildLinkDiscoveryAnalysis({
      detectedNameCount: multiPlaceSignals.detectedNameCount,
      isLikelyMultiPlacePost: multiPlaceSignals.isLikelyMultiPlacePost,
      matchedItemCount: visibleItems.length,
      shouldSuppressAmbiguousItems,
    });

    return {
      analysis,
      items: visibleItems,
      page: pageSummary,
      queryHints:
        presentableQueryHints.length > 0 ? presentableQueryHints : visibleQueryHints,
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
    explicitVenueConstraints: ExplicitVenueConstraint[],
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
      const queryConstraints = explicitVenueConstraints.filter(constraint => {
        return doesQueryMatchVenueConstraint(query, constraint);
      });

      results.slice(0, 4).forEach((result, resultIndex) => {
        if (
          queryConstraints.length > 0 &&
          !queryConstraints.some(constraint => {
            return doesResultMatchVenueConstraint(result, constraint);
          })
        ) {
          return;
        }

        const key = `${result.provider}:${result.providerPlaceId}`;
        const haystack = `${result.name} ${result.address}`.toLowerCase();
        const matchedLocationHint =
          pageSummary.locationHints.find(locationHint => {
            return haystack.includes(locationHint.toLowerCase());
          }) ?? null;
        const matchedTitleTokens = titleTokens.filter(token => {
          return haystack.includes(token);
        });
        const titleTokenHits = matchedTitleTokens.length;
        const score =
          100 -
          queryIndex * 12 -
          resultIndex * 4 +
          titleTokenHits * 8 +
          (matchedLocationHint ? 10 : 0) +
          locationHints.filter(locationHint => haystack.includes(locationHint)).length;
        const matchConfidence = buildMatchConfidence({
          score,
          hasLocationHint: Boolean(matchedLocationHint),
          resultIndex,
          titleTokenHits,
        });
        const matchReasons = buildMatchReasons({
          matchedLocationHint,
          matchedTitleTokens,
          query,
          resultIndex,
        });

        const currentCandidate = candidates.get(key);

        if (!currentCandidate || score > currentCandidate.score) {
          candidates.set(key, {
            ...result,
            locationHint: matchedLocationHint,
            matchedQuery: query,
            matchConfidence,
            matchReasons,
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

function buildMatchConfidence({
  score,
  hasLocationHint,
  resultIndex,
  titleTokenHits,
}: {
  score: number;
  hasLocationHint: boolean;
  resultIndex: number;
  titleTokenHits: number;
}): LinkDiscoveryMatchConfidence {
  if (
    score >= 110 ||
    (resultIndex === 0 && hasLocationHint && titleTokenHits > 0)
  ) {
    return 'high';
  }

  if (score >= 95 || hasLocationHint || titleTokenHits > 0 || resultIndex === 0) {
    return 'medium';
  }

  return 'low';
}

function buildMatchReasons({
  matchedLocationHint,
  matchedTitleTokens,
  query,
  resultIndex,
}: {
  matchedLocationHint: string | null;
  matchedTitleTokens: string[];
  query: string;
  resultIndex: number;
}): LinkDiscoveryMatchReason[] {
  const reasons: LinkDiscoveryMatchReason[] = [
    {
      type: 'query',
      query,
    },
  ];

  if (matchedLocationHint) {
    reasons.push({
      type: 'location',
      location: matchedLocationHint,
    });
  }

  if (matchedTitleTokens.length > 0) {
    reasons.push({
      type: 'titleTokens',
      tokens: matchedTitleTokens.slice(0, 3),
    });
  }

  if (resultIndex < 3) {
    reasons.push({
      type: 'searchRank',
      rank: resultIndex + 1,
    });
  }

  return reasons;
}

function buildLinkDiscoveryAnalysis(input: {
  detectedNameCount: number;
  isLikelyMultiPlacePost: boolean;
  matchedItemCount: number;
  shouldSuppressAmbiguousItems: boolean;
}): LinkDiscoveryAnalysis {
  if (!input.isLikelyMultiPlacePost) {
    return {
      detectedNameCount: input.detectedNameCount,
      kind: 'single',
      matchedItemCount: input.matchedItemCount,
      status: 'ready',
    };
  }

  const isPartial =
    input.shouldSuppressAmbiguousItems ||
    input.matchedItemCount === 0 ||
    (input.detectedNameCount >= 2 &&
      input.matchedItemCount < input.detectedNameCount) ||
    (input.detectedNameCount < 2 && input.matchedItemCount < 2);

  return {
    detectedNameCount: input.detectedNameCount,
    kind: 'multi',
    matchedItemCount: input.matchedItemCount,
    status: isPartial ? 'partial' : 'ready',
  };
}

function summarizePage(
  html: string,
  url: string,
  instagramEmbedHtml: string | null = null,
): PageSummary {
  const instagramEmbedBodyText = buildInstagramEmbedBodyText(instagramEmbedHtml);
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
    ...extractInstagramEmbedImageUrls(instagramEmbedHtml, url),
    ...extractPageImageUrls(html, url),
  ]).slice(0, maxImageUrls);
  const bodyText = shouldFetchInstagramEmbed(url)
    ? instagramEmbedBodyText
    : normalizeWhitespace(stripHtml(html));
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
  const locationScopedExplicitQueries = explicitQueryHints.flatMap(explicitHint => {
    return [
      explicitHint,
      ...pageSummary.locationHints.slice(0, 2).map(locationHint => {
        return `${locationHint} ${explicitHint}`;
      }),
    ];
  });

  if (explicitQueryHints.length > 0) {
    return uniqueCompact(locationScopedExplicitQueries).slice(
      0,
      MAX_VISIBLE_QUERY_HINTS,
    );
  }

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
  const markerHints = uniqueExplicitHints([
    ...extractInstagramStructuredListHints(pageSummary.title, 126),
    ...extractInstagramStructuredListHints(pageSummary.description, 108),
    ...extractInstagramStructuredListHints(pageSummary.contentPreview, 90),
    ...extractInstagramMarkerHints(pageSummary.title, 120),
    ...extractInstagramMarkerHints(pageSummary.description, 90),
    ...extractInstagramMarkerHints(pageSummary.contentPreview, 60),
    ...extractInstagramPlaceMarkerHints(pageSummary.title, 125),
    ...extractInstagramPlaceMarkerHints(pageSummary.description, 100),
    ...extractInstagramPlaceMarkerHints(pageSummary.contentPreview, 80),
    ...extractAddressBoundPlaceHints(pageSummary.title, 122),
    ...extractAddressBoundPlaceHints(pageSummary.description, 130),
    ...extractAddressBoundPlaceHints(pageSummary.contentPreview, 92),
    ...extractCommaDelimitedPlaceHints(pageSummary.title, 110),
    ...extractCommaDelimitedPlaceHints(pageSummary.description, 118),
    ...extractCommaDelimitedPlaceHints(pageSummary.contentPreview, 86),
  ]);

  if (markerHints.length > 0) {
    return markerHints
      .sort((left, right) => right.score - left.score)
      .map(hint => hint.value)
      .slice(0, 8);
  }

  const rankedHints = uniqueExplicitHints([
    ...extractInstagramNarrativeHints(pageSummary.title, 110),
    ...extractInstagramNarrativeHints(pageSummary.description, 85),
    ...extractInstagramNarrativeHints(pageSummary.contentPreview, 55),
  ]);

  return rankedHints
    .sort((left, right) => right.score - left.score)
    .map(hint => hint.value)
    .slice(0, 8);
}

function extractExplicitVenueConstraints(
  pageSummary: PageSummary,
): ExplicitVenueConstraint[] {
  return uniqueVenueConstraints([
    ...extractAddressBoundVenueConstraints(pageSummary.title),
    ...extractAddressBoundVenueConstraints(pageSummary.description),
    ...extractAddressBoundVenueConstraints(pageSummary.contentPreview),
  ]);
}

function normalizeUrl(value: string): string {
  let normalizedUrl: URL;
  const decodedCandidate = decodeUrlCandidate(value.trim());

  try {
    normalizedUrl = unwrapKnownRedirectUrl(new URL(decodedCandidate));
  } catch {
    throw new AppError(400, 'VALIDATION_ERROR', 'url must be a valid http link');
  }

  if (
    normalizedUrl.protocol !== 'https:' &&
    normalizedUrl.protocol !== 'http:'
  ) {
    throw new AppError(400, 'VALIDATION_ERROR', 'url must be a valid http link');
  }

  normalizedUrl = canonicalizeKnownMediaUrl(normalizedUrl);

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

function detectMultiPlaceSignals(
  pageSummary: PageSummary,
  explicitQueryHints: string[],
): {
  detectedNameCount: number;
  isLikelyMultiPlacePost: boolean;
} {
  const isInstagramUrl = getHostname(pageSummary.url).includes('instagram.com');
  const source = [
    pageSummary.title,
    pageSummary.description,
    pageSummary.contentPreview,
  ]
    .filter(Boolean)
    .join(' ');
  const normalizedSource = source.toLowerCase();
  const placeMarkerCount = countMatches(source, /[📍📌]/gu);
  const handleCount = countMatches(source, /(^|[\s(])@{1,2}[가-힣A-Za-z0-9._]{2,30}/gu);
  const listKeywordCount = MULTI_PLACE_KEYWORDS.filter(keyword => {
    return normalizedSource.includes(keyword.toLowerCase());
  }).length;
  const categoryKeywordCount = MULTI_PLACE_CATEGORY_KEYWORDS.filter(keyword => {
    return normalizedSource.includes(keyword.toLowerCase());
  }).length;
  const detectedNameCount = explicitQueryHints.length;
  const hasSingleAddressBoundVenue =
    detectedNameCount === 1 && countMatches(source, KOREAN_ADDRESS_PATTERN) >= 1;
  if (hasSingleAddressBoundVenue) {
    return {
      detectedNameCount,
      isLikelyMultiPlacePost: false,
    };
  }
  const hasExplicitMultiVenueSignals =
    detectedNameCount >= 2 ||
    handleCount >= 2 ||
    (placeMarkerCount >= 2 && detectedNameCount >= 2);
  const looksLikeRoundup =
    isInstagramUrl &&
    (listKeywordCount >= 2 || (listKeywordCount >= 1 && categoryKeywordCount >= 1));

  return {
    detectedNameCount,
    isLikelyMultiPlacePost: hasExplicitMultiVenueSignals || looksLikeRoundup,
  };
}

function countMatches(value: string, pattern: RegExp): number {
  return [...value.matchAll(pattern)].length;
}

function extractLocationHints(source: string): string[] {
  const normalizedSource = source.toLowerCase();
  const locationHints = LOCATION_HINTS.filter(locationHint => {
    return locationHint.patterns.some(pattern =>
      normalizedSource.includes(pattern.toLowerCase()),
    );
  }).map(locationHint => locationHint.label);
  const compositeLocationHints = extractCompositeLocationHints(source);
  const addressLocalityHints = extractAddressLocalityHints(source);
  const addressHints = [...source.matchAll(ADDRESS_PATTERN)].map(match => {
    return normalizeWhitespace(match[0]);
  });

  return uniqueCompact([
    ...locationHints,
    ...compositeLocationHints,
    ...addressLocalityHints,
    ...addressHints,
  ]).slice(0, 4);
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
    const koreanInstagramCaptionMatch =
      /Instagram의\s+[^:]+:\s*"?([\s\S]+?)"?$/u.exec(title);

    if (koreanInstagramCaptionMatch?.[1]) {
      const cleanedInstagramCaption = normalizeWhitespace(
        stripInstagramHashtagTail(
          trimTrailingQuotePeriod(
            stripWrappingQuotes(koreanInstagramCaptionMatch[1]),
          ),
        ),
      );

      return isGenericInstagramTitle(cleanedInstagramCaption)
        ? null
        : cleanedInstagramCaption;
    }

    const instagramCaptionMatch = / on Instagram:\s*"?([\s\S]+?)"?$/i.exec(title);

    if (instagramCaptionMatch?.[1]) {
      const cleanedInstagramCaption = normalizeWhitespace(
        stripInstagramHashtagTail(
          trimTrailingQuotePeriod(stripWrappingQuotes(instagramCaptionMatch[1])),
        ),
      );

      return isGenericInstagramTitle(cleanedInstagramCaption)
        ? null
        : cleanedInstagramCaption;
    }

    const cleanedInstagramTitle = normalizeWhitespace(
      stripInstagramHashtagTail(
        trimTrailingQuotePeriod(
          title.replace(/\s*\([^)]*\)\s*•\s*Instagram photos and videos$/i, ''),
        ),
      ),
    );

    return isGenericInstagramTitle(cleanedInstagramTitle)
      ? null
      : cleanedInstagramTitle;
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

    const normalizedDescription = normalizeWhitespace(
      stripInstagramHashtagTail(
        trimTrailingQuotePeriod(stripWrappingQuotes(cleanedInstagramDescription)),
      ),
    );

    return isGenericInstagramDescription(normalizedDescription)
      ? null
      : normalizedDescription;
  }

  return normalizeWhitespace(
    trimTrailingQuotePeriod(stripWrappingQuotes(description)),
  );
}

function cleanBodyText(bodyText: string, url: string): string {
  const hostname = getHostname(url);

  if (hostname.includes('instagram.com')) {
    return normalizeWhitespace(bodyText)
      .replace(/\bView more on Instagram\b/gi, ' ')
      .replace(/\bView all \d[\d,]* comments?\b/gi, ' ')
      .replace(/\bAdd a comment\.\.\.\b/gi, ' ')
      .replace(/\bView profile\b/gi, ' ')
      .replace(/\b\d[\d,]* likes?\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
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
  const hints = [...normalizedValue.matchAll(/📌\s*([^📍🕐⏰⌨❌@#\[\]\n]{2,40})/gu)]
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

function extractInstagramStructuredListHints(
  value: string | null,
  score: number,
): ExplicitQueryHint[] {
  if (!value) {
    return [];
  }

  const normalizedValue = normalizeWhitespace(value);

  return uniqueExplicitHints(
    [...normalizedValue.matchAll(/[▶▸▹]\s*([^▶▸▹▷📍🕐⏰⌨❌@#☆★]{2,40}?)(?=\s*(?:\(|▷|🕐|⏰|@|#|$))/gu)]
      .map(match => normalizeStructuredPlaceHint(match[1] ?? ''))
      .filter(Boolean)
      .filter(isLikelyExplicitPlaceHint)
      .map(hint => {
        return {
          score,
          value: hint,
        };
      }),
  );
}

function extractInstagramPlaceMarkerHints(
  value: string | null,
  score: number,
): ExplicitQueryHint[] {
  if (!value) {
    return [];
  }

  const normalizedValue = normalizeWhitespace(value);

  return [...normalizedValue.matchAll(/📍\s*([^📍📌🕐⏰⌨❌@#\[\]:]{2,40})/gu)]
    .map(match => normalizeInstagramPlaceMarkerHint(match[1] ?? ''))
    .filter(Boolean)
    .filter(isLikelyExplicitPlaceHint)
    .map(hint => {
      return {
        score,
        value: hint,
      };
    });
}

function extractAddressBoundPlaceHints(
  value: string | null,
  score: number,
): ExplicitQueryHint[] {
  if (!value) {
    return [];
  }

  const normalizedValue = normalizeWhitespace(value);

  return uniqueExplicitHints(
    [...normalizedValue.matchAll(KOREAN_ADDRESS_PATTERN)]
      .map(match => {
        const addressIndex = match.index ?? 0;
        const prefix = normalizedValue.slice(Math.max(0, addressIndex - 40), addressIndex);

        if (/[📍📌▶▸▹]/u.test(prefix)) {
          return null;
        }

        return normalizeAddressBoundPlaceHint(prefix);
      })
      .filter((hint): hint is string => Boolean(hint))
      .filter(isLikelyExplicitPlaceHint)
      .map(hint => {
        return {
          score,
          value: hint,
        };
      }),
  );
}

function extractAddressBoundVenueConstraints(
  value: string | null,
): ExplicitVenueConstraint[] {
  if (!value) {
    return [];
  }

  const normalizedValue = normalizeWhitespace(value);

  return [...normalizedValue.matchAll(KOREAN_ADDRESS_PATTERN)]
    .map(match => {
      const address = normalizeWhitespace(match[0] ?? '');
      const addressIndex = match.index ?? 0;
      const prefix = normalizedValue.slice(Math.max(0, addressIndex - 56), addressIndex);
      const name = extractVenueNameNearAddress(prefix);

      if (!name || !isLikelyExplicitPlaceHint(name)) {
        return null;
      }

      return {
        address,
        name,
      } satisfies ExplicitVenueConstraint;
    })
    .filter((constraint): constraint is ExplicitVenueConstraint => Boolean(constraint));
}

function extractCommaDelimitedPlaceHints(
  value: string | null,
  score: number,
): ExplicitQueryHint[] {
  if (!value) {
    return [];
  }

  const normalizedValue = normalizeWhitespace(value);
  const candidates = [...normalizedValue.matchAll(/(?:^|[\s(])([가-힣A-Za-z0-9&]{2,24})(?=,\s)/gu)]
    .map(match => normalizeCommaDelimitedPlaceHint(match[1] ?? ''))
    .filter(Boolean)
    .filter(isLikelyCommaDelimitedPlaceHint);

  if (candidates.length < 2) {
    return [];
  }

  return uniqueExplicitHints(
    candidates.map(candidate => {
      return {
        score,
        value: candidate,
      };
    }),
  );
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
    /(?:^|[\s([{"'“‘])(?:맛집|카페|식당|고깃집|술집|막창집|베이커리|바)\s+([가-힣A-Za-z0-9&]{2,20})(?=\s|$)/gu,
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

function normalizeStructuredPlaceHint(value: string): string {
  return normalizeExplicitHint(
    value
      .replace(/\([^)]*\)$/u, '')
      .replace(/\s+(?:주말|평일)\s*$/u, '')
      .trim(),
  );
}

function normalizeInstagramPlaceMarkerHint(value: string): string {
  const normalizedValue = normalizeExplicitHint(value);
  const addressStartMatch =
    /\s+(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)\s+[가-힣A-Za-z0-9.-]+?(?:구|군|시|읍|면|동|로|길|가)(?=\s|$)/u.exec(
      normalizedValue,
    );

  if (!addressStartMatch || addressStartMatch.index === undefined) {
    return normalizedValue;
  }

  return normalizeExplicitHint(
    normalizedValue.slice(0, addressStartMatch.index),
  );
}

function normalizeAddressBoundPlaceHint(value: string): string {
  const sentenceTail = value.split(/[.!?~…]/u).at(-1) ?? value;
  const normalizedTail = normalizeWhitespace(sentenceTail)
    .replace(/^[^가-힣A-Za-z0-9&]+/u, '')
    .trim();
  const nextValue =
    normalizedTail.split(/\s+/).length > 4
      ? normalizedTail.split(/\s+/).slice(-4).join(' ')
      : normalizedTail;

  return normalizeExplicitHint(nextValue);
}

function extractVenueNameNearAddress(value: string): string | null {
  const markerCandidates = uniqueCompact([
    ...[...value.matchAll(/[📌📍]\s*([^📌📍▶▸▹@#\n]{2,40})/gu)].map(match => {
      return normalizeInstagramPlaceMarkerHint(match[1] ?? '');
    }),
    ...[...value.matchAll(/[▶▸▹]\s*([^▶▸▹📍📌@#\n]{2,40})/gu)].map(match => {
      return normalizeStructuredPlaceHint(match[1] ?? '');
    }),
  ]);

  if (markerCandidates.length > 0) {
    return markerCandidates.at(-1) ?? null;
  }

  const handleCandidates = [...value.matchAll(/@{1,2}([가-힣A-Za-z0-9._]{2,30})/gu)]
    .map(match => normalizeExplicitHint(match[1] ?? ''))
    .filter(Boolean);

  if (handleCandidates.length > 0) {
    return handleCandidates.at(-1) ?? null;
  }

  const normalizedFallback = normalizeAddressBoundPlaceHint(value);

  return normalizedFallback || null;
}

function normalizeCommaDelimitedPlaceHint(value: string): string {
  return normalizeExplicitHint(value);
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

  if (value.split(/\s+/).length > 3) {
    return false;
  }

  if (/[0-9]{2,}/.test(value)) {
    return false;
  }

  if (/[가-힣]{2,}[A-Z]$/u.test(value)) {
    return false;
  }

  const loweredValue = value.toLowerCase();

  if (
    [
      '맛집',
      '카페',
      '야장',
      '명소',
      '놀거리',
      '직접',
      '보고',
      '이건',
      '여긴',
      '도장깨기',
      '고기',
      '미나리',
      '노포갬성',
    ].includes(loweredValue)
  ) {
    return false;
  }

  return ![
    '인스타그램',
    '요즘 핫한',
    '판매처',
    '버터떡',
    '유료광고포함',
    '필수코스',
    '공개합니다',
    '가면',
    '여긴 필수',
    '시장표',
  ].some(fragment => loweredValue.includes(fragment));
}

function isLikelyCommaDelimitedPlaceHint(value: string): boolean {
  if (!isLikelyExplicitPlaceHint(value)) {
    return false;
  }

  const loweredValue = value.toLowerCase();

  return ![
    '강릉여행',
    '서울여행',
    '전주여행',
    '시장표맛집',
    '시장맛집',
    '맛집추천',
    '필수코스',
    '공개합니다',
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
      '도장깨기',
      '집',
      '제대로',
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

function isPresentableQueryHint(value: string): boolean {
  const normalizedValue = normalizeWhitespace(value);

  if (!normalizedValue) {
    return false;
  }

  if (normalizedValue.split(/\s+/).length > 3) {
    return false;
  }

  if (/[가-힣]{2,}[A-Z]$/u.test(normalizedValue)) {
    return false;
  }

  const loweredValue = normalizedValue.toLowerCase();

  if (
    ['고기', '미나리', '노포갬성', '0감정', '삼은l', '강을', '직접'].includes(
      loweredValue,
    )
  ) {
    return false;
  }

  return ![
    '나만 알고 싶은',
    '이걸 참는다고',
    '여긴 필수',
    '가면',
    '돌판 맛집',
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

function extractCompositeLocationHints(source: string): string[] {
  return uniqueCompact(
    [...source.matchAll(/([가-힣A-Za-z]{2,12})(?:맛집|카페|여행|가볼만한곳|야장)\b/gu)]
      .map(match => normalizeWhitespace(match[1] ?? ''))
      .filter(value => value.length >= 2),
  );
}

function extractAddressLocalityHints(source: string): string[] {
  const metroPattern = new RegExp(
    `((?:${KOREAN_METRO_AREAS.join('|')})(?:특별시|광역시|시)?)\\s+[가-힣A-Za-z0-9.-]+(?:구|군|시)`,
    'gu',
  );
  const provincePattern = new RegExp(
    `((?:${[...KOREAN_PROVINCES, ...KOREAN_SPECIAL_PROVINCES].join('|')})(?:특별자치도|도)?)\\s+([가-힣A-Za-z0-9.-]+(?:시|군))`,
    'gu',
  );

  return uniqueCompact([
    ...[...source.matchAll(metroPattern)].map(match => {
      return normalizeMetroAreaLabel(match[1] ?? '');
    }),
    ...[...source.matchAll(provincePattern)].map(match => {
      return normalizeProvinceLocalityLabel(match[2] ?? '');
    }),
  ]);
}

function normalizeMetroAreaLabel(value: string): string {
  return value.replace(/특별시|광역시|시$/u, '').trim();
}

function normalizeProvinceLocalityLabel(value: string): string {
  return value.replace(/시|군$/u, '').trim();
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

function uniqueVenueConstraints(
  values: ExplicitVenueConstraint[],
): ExplicitVenueConstraint[] {
  const map = new Map<string, ExplicitVenueConstraint>();

  for (const value of values) {
    const key = `${normalizeMatchKey(value.name)}::${normalizeAddressComparable(value.address)}`;

    if (!map.has(key)) {
      map.set(key, value);
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

function buildInstagramEmbedBodyText(html: string | null): string {
  if (!html) {
    return '';
  }

  return normalizeWhitespace(
    [
      extractInstagramEmbedLocation(html),
      extractInstagramEmbedCaption(html),
    ]
      .filter(Boolean)
      .join(' '),
  );
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function doesQueryMatchVenueConstraint(
  query: string,
  constraint: ExplicitVenueConstraint,
): boolean {
  const normalizedQuery = normalizeMatchKey(query);
  const normalizedName = normalizeMatchKey(constraint.name);

  return (
    normalizedQuery.includes(normalizedName) ||
    normalizedName.includes(normalizedQuery)
  );
}

function doesResultMatchVenueConstraint(
  result: PlaceSearchResult,
  constraint: ExplicitVenueConstraint,
): boolean {
  if (!doesQueryMatchVenueConstraint(result.name, constraint)) {
    return false;
  }

  return doesResultAddressMatchConstraint(result, constraint.address);
}

function doesResultAddressMatchConstraint(
  result: PlaceSearchResult,
  expectedAddress: string,
): boolean {
  const comparableExpectedAddress = normalizeAddressComparable(expectedAddress);
  const candidateAddresses = uniqueCompact([result.address, result.roadAddress]).map(
    normalizeAddressComparable,
  );

  if (
    candidateAddresses.some(candidateAddress => {
      return (
        candidateAddress.includes(comparableExpectedAddress) ||
        comparableExpectedAddress.includes(candidateAddress)
      );
    })
  ) {
    return true;
  }

  const expectedTokens = extractAddressMatchTokens(expectedAddress);
  const candidateTokens = new Set(
    candidateAddresses.flatMap(candidateAddress => {
      return extractAddressMatchTokens(candidateAddress);
    }),
  );
  const sharedTokenCount = expectedTokens.filter(token => {
    return candidateTokens.has(token);
  }).length;
  const numericTokens = expectedTokens.filter(token => /\d/.test(token));
  const requiresNumericTokenMatch = numericTokens.length > 0;
  const hasNumericTokenMatch = numericTokens.some(token => candidateTokens.has(token));

  return (
    sharedTokenCount >= Math.min(2, expectedTokens.length) &&
    (!requiresNumericTokenMatch || hasNumericTokenMatch)
  );
}

function normalizeMatchKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9가-힣]+/g, '');
}

function normalizeAddressComparable(value: string): string {
  return normalizeWhitespace(value)
    .replace(/(?:지하)?\d+층(?:\s+\d+호)?/gu, ' ')
    .replace(/\d+호/gu, ' ')
    .replace(/\s+/g, '');
}

function extractAddressMatchTokens(value: string): string[] {
  return uniqueCompact(
    normalizeWhitespace(value)
      .split(/\s+/)
      .map(token => token.trim())
      .filter(token => token.length >= 2)
      .filter(token => !/^(?:지하)?\d+층$|^\d+호$/u.test(token))
      .filter(token => token !== '대한민국')
      .map(token => token.toLowerCase()),
  );
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
  const normalizedUrl = canonicalizeInstagramMediaUrl(new URL(url));
  const pathname = normalizedUrl.pathname.replace(/\/$/, '');

  return `${normalizedUrl.origin}${pathname}/embed/captioned/`;
}

function canonicalizeKnownMediaUrl(url: URL): URL {
  if (!getHostname(url.toString()).includes('instagram.com')) {
    return url;
  }

  return canonicalizeInstagramMediaUrl(url);
}

function canonicalizeInstagramMediaUrl(url: URL): URL {
  const mediaPath = extractInstagramMediaPath(url);

  if (!mediaPath) {
    return url;
  }

  const canonicalUrl = new URL(url.toString());
  canonicalUrl.pathname = `/${mediaPath.kind}/${mediaPath.code}/`;

  return canonicalUrl;
}

function extractInstagramMediaPath(
  url: URL,
): { code: string; kind: 'p' | 'reel' | 'tv' } | null {
  const pathnameParts = url.pathname
    .split('/')
    .map(part => part.trim())
    .filter(Boolean);

  for (let index = 0; index < pathnameParts.length - 1; index += 1) {
    const kind = pathnameParts[index]?.toLowerCase();

    if (kind !== 'p' && kind !== 'reel' && kind !== 'tv') {
      continue;
    }

    const code = pathnameParts[index + 1]?.trim();

    if (!code) {
      return null;
    }

    return {
      code,
      kind,
    };
  }

  return null;
}

function extractInstagramEmbedCaption(html: string | null): string | null {
  if (!html) {
    return null;
  }

  const startIndex = html.indexOf('<div class="Caption">');

  if (startIndex < 0) {
    return null;
  }

  const footerIndex = html.indexOf('<div class="Footer">', startIndex);
  const captionSlice =
    footerIndex > startIndex
      ? html.slice(startIndex, footerIndex)
      : html.slice(startIndex, startIndex + 12_000);
  const normalizedCaption = normalizeWhitespace(stripHtml(captionSlice))
    .replace(/^[A-Za-z0-9._]+\s+/u, '')
    .replace(/\bView all \d[\d,]* comments?\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return normalizedCaption || null;
}

function extractInstagramEmbedLocation(html: string | null): string | null {
  if (!html) {
    return null;
  }

  const locationMatch = /class="Location"[^>]*>([^<]{2,80})</i.exec(html);

  return locationMatch
    ? decodeHtmlEntities(normalizeWhitespace(locationMatch[1] ?? ''))
    : null;
}

function extractInstagramEmbedImageUrls(
  html: string | null,
  pageUrl: string,
): string[] {
  if (!html) {
    return [];
  }

  const imageTags = [...html.matchAll(/<img[^>]*EmbeddedMediaImage[^>]*>/gi)].map(
    match => match[0],
  );

  return uniqueCompact(
    imageTags
      .map(tag => {
        const directSrcMatch =
          /(?:src|data-src)=["']([^"']+)["']/i.exec(tag)?.[1] ?? null;

        if (directSrcMatch) {
          return directSrcMatch;
        }

        const srcsetMatch =
          /(?:srcset|data-srcset)=["']([^"']+)["']/i.exec(tag)?.[1] ?? null;

        return srcsetMatch ? extractFirstSrcsetUrl(srcsetMatch) : null;
      })
      .map(imageUrl => resolveImageUrl(imageUrl ?? '', pageUrl))
      .filter(isNonEmptyString)
      .filter(isLikelyContentImageUrl),
  );
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

function isGenericInstagramTitle(value: string): boolean {
  return value.trim().toLowerCase() === 'instagram';
}

function isGenericInstagramDescription(value: string): boolean {
  return value
    .trim()
    .toLowerCase()
    .startsWith('create an account or log in to instagram');
}

function decodeUrlCandidate(value: string): string {
  let nextValue = value;

  for (let index = 0; index < 2; index += 1) {
    try {
      const decodedValue = decodeURIComponent(nextValue);

      if (decodedValue === nextValue) {
        break;
      }

      nextValue = decodedValue;
    } catch {
      break;
    }
  }

  return nextValue;
}

function unwrapKnownRedirectUrl(url: URL): URL {
  const hostname = url.hostname.toLowerCase();

  if (
    hostname !== 'l.instagram.com' &&
    hostname !== 'l.facebook.com' &&
    hostname !== 'lm.facebook.com'
  ) {
    return url;
  }

  const nestedUrl = firstNonEmpty([
    url.searchParams.get('u'),
    url.searchParams.get('url'),
  ]);

  if (!nestedUrl) {
    return url;
  }

  try {
    return new URL(decodeUrlCandidate(nestedUrl));
  } catch {
    return url;
  }
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
