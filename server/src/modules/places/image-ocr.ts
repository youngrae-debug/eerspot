import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const IMAGE_OCR_TIMEOUT_MS = 15000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_HINTS = 12;
const swiftScriptPath = fileURLToPath(
  new URL('../../../scripts/vision-ocr.swift', import.meta.url),
);

const OCR_STOP_WORDS = new Set([
  '가',
  '깨기',
  '도장',
  '맛집',
  '부산',
  '빕',
  '서울',
  '오버',
  '이번에도',
  '장',
  '정리',
  '총정리',
  '하러',
  '구르망',
  'list',
  'over',
]);
const OCR_BLOCKED_FRAGMENTS = [
  '깨기',
  '도장',
  '등록',
  '업체',
  '이미지',
  '하러',
  'instagram',
  'list',
  'meta',
  'over',
  'ovet',
  '구망',
  '총정리',
];
const LOCATION_NOISE_TOKENS = new Set([
  '부산',
  '서울',
]);
const COMMON_PLACE_PATTERNS = [
  '국밥',
  '국수',
  '궁',
  '관',
  '교',
  '구보',
  '당',
  '라멘',
  '랩',
  '만두',
  '막국수',
  '면',
  '면옥',
  '메밀',
  '밥상',
  '식당',
  '수제비',
  '옥',
  '온정',
  '전골',
  '정',
  '족발',
  '집',
  '칼국수',
  '파스타',
  '평냉',
  '회관',
  '하우스',
];

export type ImageOcrClient = {
  extractHints: (imageUrl: string) => Promise<string[]>;
};

type VisionOcrPayload = {
  lines?: string[];
};

export class VisionImageOcrClient implements ImageOcrClient {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async extractHints(imageUrl: string): Promise<string[]> {
    const tempDir = await mkdtemp(join(tmpdir(), 'eerspot-ocr-'));
    const imagePath = join(tempDir, 'image-source');

    try {
      const response = await this.fetchImpl(imageUrl, {
        headers: {
          Accept: 'image/*',
        },
      });

      if (!response.ok) {
        return [];
      }

      const imageBuffer = Buffer.from(await response.arrayBuffer());

      if (imageBuffer.length === 0 || imageBuffer.length > MAX_IMAGE_BYTES) {
        return [];
      }

      await writeFile(imagePath, imageBuffer);

      const { stdout } = await execFileAsync(
        'swift',
        [swiftScriptPath, imagePath],
        {
          maxBuffer: 1024 * 1024,
          timeout: IMAGE_OCR_TIMEOUT_MS,
        },
      );

      return extractCandidatePhrases(parseVisionPayload(stdout).lines ?? []);
    } catch {
      return [];
    } finally {
      await rm(tempDir, {
        force: true,
        recursive: true,
      });
    }
  }
}

function parseVisionPayload(stdout: string): VisionOcrPayload {
  try {
    const payload = JSON.parse(stdout) as VisionOcrPayload;

    return {
      lines: Array.isArray(payload.lines)
        ? payload.lines.filter((value): value is string => typeof value === 'string')
        : [],
    };
  } catch {
    return {
      lines: [],
    };
  }
}

function extractCandidatePhrases(lines: string[]): string[] {
  const rawCandidates = lines.flatMap(line => {
    const normalizedLine = normalizeCandidatePhrase(line);

    if (!normalizedLine) {
      return [];
    }

    const compactChunks = normalizedLine
      .split(/\s*[|·•,/]\s*/g)
      .map(chunk => normalizeCandidatePhrase(chunk))
      .filter(Boolean);

    return [normalizedLine, ...compactChunks];
  });

  const exactCandidates = uniqueCompact(
    rawCandidates.filter(isLikelyPlaceHint),
  ).map((value, index) => {
    return buildCandidateHint(value, index);
  });
  const dedupedCandidates = dedupeSimilarCandidates(exactCandidates);
  const rankedCandidates = dedupedCandidates.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return left.index - right.index;
  });

  return rankedCandidates
    .slice(0, MAX_HINTS)
    .sort((left, right) => left.index - right.index)
    .map(candidate => candidate.value);
}

function normalizeOcrValue(value: string): string {
  return value
    .replace(/[^\p{Script=Hangul}\p{Script=Latin}\d\s&().-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeCandidatePhrase(value: string): string {
  return normalizeOcrValue(value)
    .replace(/^[\s().-]+|[\s().-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isLikelyPlaceHint(value: string): boolean {
  if (value.length < 2 || value.length > 24) {
    return false;
  }

  if (/^\d+$/.test(value)) {
    return false;
  }

  const loweredValue = value.toLowerCase();

  if (OCR_BLOCKED_FRAGMENTS.some(fragment => loweredValue.includes(fragment))) {
    return false;
  }

  const tokens = loweredValue.split(/\s+/g).filter(Boolean);

  if (tokens.length === 0) {
    return false;
  }

  if (tokens.every(token => OCR_STOP_WORDS.has(token))) {
    return false;
  }

  if (looksLikeLocationNoise(value, tokens)) {
    return false;
  }

  if (/^[A-Z]{4,}$/.test(value)) {
    return false;
  }

  const hangulMatches = value.match(/[가-힣]/g) ?? [];
  const latinMatches = value.match(/[A-Za-z]/g) ?? [];

  if (hangulMatches.length >= 2) {
    return true;
  }

  return latinMatches.length >= 4;
}

function uniqueCompact(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

type CandidateHint = {
  compact: string;
  index: number;
  score: number;
  value: string;
};

function buildCandidateHint(value: string, index: number): CandidateHint {
  return {
    compact: compactCandidateValue(value),
    index,
    score: scoreCandidateHint(value, index),
    value,
  };
}

function compactCandidateValue(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9가-힣]+/g, '');
}

function scoreCandidateHint(value: string, index: number): number {
  let score = 100 - index;

  if (containsCommonPlacePattern(value)) {
    score += 8;
  }

  if (/^\d+\s*대/.test(value)) {
    score += 6;
  }

  if (/^[A-Za-z가-힣]+LAB$/i.test(value)) {
    score += 4;
  }

  if (/[0-9]/.test(value) && !/^\d+\s*대/.test(value)) {
    score -= 8;
  }

  if (/[()]/.test(value)) {
    score -= 6;
  }

  if (/^[A-Z]{4,}$/.test(value)) {
    score -= 12;
  }

  if (looksLikeLocationNoise(value, value.toLowerCase().split(/\s+/g).filter(Boolean))) {
    score -= 20;
  }

  return score;
}

function containsCommonPlacePattern(value: string): boolean {
  return COMMON_PLACE_PATTERNS.some(pattern => value.includes(pattern));
}

function looksLikeLocationNoise(value: string, tokens: string[]): boolean {
  if (tokens.some(token => LOCATION_NOISE_TOKENS.has(token))) {
    return !containsCommonPlacePattern(value);
  }

  return (
    /(^|[\s(])(?:서울|부산)(?:[\s)\d]|$)/u.test(value) &&
    !containsCommonPlacePattern(value)
  );
}

function dedupeSimilarCandidates(candidates: CandidateHint[]): CandidateHint[] {
  const nextCandidates: CandidateHint[] = [];

  for (const candidate of candidates) {
    const existingIndex = nextCandidates.findIndex(currentCandidate => {
      return areSimilarCandidates(currentCandidate, candidate);
    });

    if (existingIndex < 0) {
      nextCandidates.push(candidate);
      continue;
    }

    if (candidate.score > nextCandidates[existingIndex].score) {
      nextCandidates[existingIndex] = candidate;
    }
  }

  return nextCandidates;
}

function areSimilarCandidates(left: CandidateHint, right: CandidateHint): boolean {
  if (left.compact === right.compact) {
    return true;
  }

  if (
    left.compact.length < 4 ||
    right.compact.length < 4 ||
    Math.abs(left.compact.length - right.compact.length) > 3
  ) {
    return false;
  }

  const distance = levenshteinDistance(left.compact, right.compact);
  const maxLength = Math.max(left.compact.length, right.compact.length);
  const allowedDistance = maxLength >= 8 ? 3 : 2;

  return distance <= allowedDistance;
}

function levenshteinDistance(left: string, right: string): number {
  const previousRow = Array.from({ length: right.length + 1 }, (_value, index) => index);
  const currentRow = new Array<number>(right.length + 1).fill(0);

  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    currentRow[0] = leftIndex + 1;

    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex] === right[rightIndex] ? 0 : 1;
      currentRow[rightIndex + 1] = Math.min(
        currentRow[rightIndex] + 1,
        previousRow[rightIndex + 1] + 1,
        previousRow[rightIndex] + substitutionCost,
      );
    }

    for (let rightIndex = 0; rightIndex <= right.length; rightIndex += 1) {
      previousRow[rightIndex] = currentRow[rightIndex];
    }
  }

  return previousRow[right.length];
}
