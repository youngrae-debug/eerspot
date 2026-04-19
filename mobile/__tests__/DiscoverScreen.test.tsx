import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import { DiscoverScreen } from '../src/features/discover/screens/DiscoverScreen';
import { LanguageProvider } from '../src/shared/i18n/LanguageContext';

jest.mock('../src/features/auth/context/AuthContext', () => ({
  useAuth: () => ({
    authorizedRequest: jest.fn(),
  }),
}));

jest.mock('../src/features/places/api/placesApi', () => ({
  listPlaces: jest.fn(),
  savePlace: jest.fn(),
}));

jest.mock('../src/features/discover/api/discoverApi', () => ({
  discoverPlacesFromLink: jest.fn(),
}));

jest.mock('../src/features/calendar/api/schedulesApi', () => ({
  createSchedule: jest.fn(),
}));

const placesApi = jest.requireMock('../src/features/places/api/placesApi') as {
  listPlaces: jest.Mock;
  savePlace: jest.Mock;
};
const discoverApi = jest.requireMock(
  '../src/features/discover/api/discoverApi',
) as {
  discoverPlacesFromLink: jest.Mock;
};
const schedulesApi = jest.requireMock(
  '../src/features/calendar/api/schedulesApi',
) as {
  createSchedule: jest.Mock;
};

const defaultDiscoverAnalysis = {
  detectedNameCount: 0,
  kind: 'single' as const,
  matchedItemCount: 0,
  status: 'ready' as const,
};

function extractTextContent(children: React.ReactNode): string {
  if (typeof children === 'string') {
    return children;
  }

  if (typeof children === 'number') {
    return String(children);
  }

  if (Array.isArray(children)) {
    return children.map(extractTextContent).join('');
  }

  return '';
}

function getAllTexts(root: ReactTestRenderer.ReactTestInstance): string[] {
  return root.findAllByType(Text).map(textNode => {
    return extractTextContent(textNode.props.children);
  });
}

afterEach(() => {
  discoverApi.discoverPlacesFromLink.mockReset();
  placesApi.listPlaces.mockReset();
  placesApi.savePlace.mockReset();
  schedulesApi.createSchedule.mockReset();
});

test('renders a link-only discover screen without the starter board', async () => {
  let instance!: ReactTestRenderer.ReactTestRenderer;

  placesApi.listPlaces.mockResolvedValue({
    items: [],
    pageInfo: {
      nextCursor: null,
      hasNext: false,
    },
  });

  await ReactTestRenderer.act(async () => {
    instance = ReactTestRenderer.create(
      <LanguageProvider>
        <DiscoverScreen onScheduleCreated={() => undefined} />
      </LanguageProvider>,
    );
  });

  await ReactTestRenderer.act(async () => {
    await Promise.resolve();
  });

  const texts = getAllTexts(instance.root);

  expect(texts).toContain('Read a link and surface venue names');
  expect(texts).toContain('Analyze link');
  expect(texts).not.toContain('Starter board');
  expect(texts).not.toContain('Save first, sort the route later');
});

test('analyzes a link and renders related place suggestions', async () => {
  let instance!: ReactTestRenderer.ReactTestRenderer;

  placesApi.listPlaces.mockResolvedValue({
    items: [],
    pageInfo: {
      nextCursor: null,
      hasNext: false,
    },
  });
  discoverApi.discoverPlacesFromLink.mockResolvedValue({
    analysis: {
      ...defaultDiscoverAnalysis,
      detectedNameCount: 2,
      kind: 'multi',
      matchedItemCount: 1,
    },
    items: [
      {
        address: '서울 성동구 성수이로 78',
        categoryGroupName: '음식점',
        categoryName: '음식점 > 카페',
        lat: 37.541569,
        lng: 127.055236,
        mapUrl: 'https://place.map.kakao.com/987654321',
        matchConfidence: 'high',
        matchReasons: [
          {
            query: '성수 카페',
            type: 'query',
          },
          {
            location: '성수',
            type: 'location',
          },
          {
            rank: 1,
            type: 'searchRank',
          },
        ],
        matchedQuery: '성수 카페',
        name: '성수 대림창고',
        locationHint: '성수',
        phone: '02-498-7474',
        provider: 'kakao',
        providerPlaceId: '987654321',
        roadAddress: '서울 성동구 성수이로7길 41',
      },
    ],
    page: {
      contentPreview:
        '성수에서 전시와 카페를 함께 둘러보기 좋은 하루 코스를 소개합니다.',
      description:
        '서울 성수에서 전시와 카페를 함께 둘러보기 좋은 하루 코스를 소개합니다.',
      locationHints: ['성수'],
      title: '성수 카페 투어 가이드',
      url: 'https://example.com/seongsu-guide',
    },
    queryHints: ['성수 카페 투어 가이드', '성수 카페'],
  });

  await ReactTestRenderer.act(async () => {
    instance = ReactTestRenderer.create(
      <LanguageProvider>
        <DiscoverScreen onScheduleCreated={() => undefined} />
      </LanguageProvider>,
    );
  });

  await ReactTestRenderer.act(async () => {
    await Promise.resolve();
  });

  await ReactTestRenderer.act(async () => {
    instance.root
      .findByProps({ testID: 'discover-link-input' })
      .props.onChangeText('https://example.com/seongsu-guide');
  });

  await ReactTestRenderer.act(async () => {
    instance.root
      .findByProps({ testID: 'discover-link-submit' })
      .props.onPress();
  });

  expect(discoverApi.discoverPlacesFromLink).toHaveBeenCalledWith(
    expect.any(Function),
    'https://example.com/seongsu-guide',
  );

  const texts = getAllTexts(instance.root);
  const renderedText = texts.join(' ');

  expect(texts).toContain('Read a link and surface venue names');
  expect(texts).toContain('성수 카페 투어 가이드');
  expect(texts).toContain('Matched places');
  expect(texts).toContain('Source URL');
  expect(texts).toContain('https://example.com/seongsu-guide');
  expect(texts).toContain('Detected shop names');
  expect(texts).toContain('성수 대림창고');
  expect(texts).toContain('High confidence');
  expect(texts).toContain('Why this place');
  expect(texts).toContain('Category');
  expect(texts).toContain('음식점 > 카페');
  expect(texts).toContain('Phone');
  expect(texts).toContain('02-498-7474');
  expect(texts).toContain('Road address');
  expect(texts).toContain('서울 성동구 성수이로7길 41');
  expect(texts).toContain('Coordinates');
  expect(texts).toContain('37.54157, 127.05524');
  expect(renderedText).toContain('Matched from the link hint "성수 카페"');
  expect(texts).toContain('성수 카페');
  expect(texts).toContain('Open in Kakao Map');
  expect(texts).toContain('Open original link');
});

test('shows search hints but hides save actions when place matching is not ready yet', async () => {
  let instance!: ReactTestRenderer.ReactTestRenderer;

  placesApi.listPlaces.mockResolvedValue({
    items: [],
    pageInfo: {
      nextCursor: null,
      hasNext: false,
    },
  });
  discoverApi.discoverPlacesFromLink.mockResolvedValue({
    analysis: {
      ...defaultDiscoverAnalysis,
      detectedNameCount: 3,
      kind: 'multi',
      status: 'partial',
    },
    items: [],
    page: {
      contentPreview: '서울과 부산의 빕 구르망 리스트를 모은 게시물입니다.',
      description: '서울과 부산의 빕 구르망 리스트를 모은 게시물입니다.',
      locationHints: ['서울', '부산'],
      title: '서울 + 부산 빕 구르망 리스트',
      url: 'https://www.instagram.com/p/example/',
    },
    queryHints: ['3대 삼계장인', '오일제', '계월'],
  });

  await ReactTestRenderer.act(async () => {
    instance = ReactTestRenderer.create(
      <LanguageProvider>
        <DiscoverScreen onScheduleCreated={() => undefined} />
      </LanguageProvider>,
    );
  });

  await ReactTestRenderer.act(async () => {
    await Promise.resolve();
  });

  await ReactTestRenderer.act(async () => {
    instance.root
      .findByProps({ testID: 'discover-link-input' })
      .props.onChangeText('https://www.instagram.com/p/example/');
  });

  await ReactTestRenderer.act(async () => {
    instance.root
      .findByProps({ testID: 'discover-link-submit' })
      .props.onPress();
  });

  const texts = getAllTexts(instance.root);
  const renderedText = texts.join(' ');

  expect(texts).toContain('Search hints');
  expect(texts).toContain('Detected shop names');
  expect(renderedText).toContain('3대 삼계장인');
  expect(renderedText).toContain('오일제');
  expect(texts).toContain('Several venues are likely in this link');
  expect(texts).toContain(
    'This looks like a multi-venue post. To avoid locking onto the wrong place, only confident matches are shown for now.',
  );
  expect(texts).toContain(
    'This looks like a roundup of several places, but the link alone did not reveal the venue names clearly enough yet.',
  );
  expect(
    instance.root.findAllByProps({ testID: 'discover-link-candidate-save-오일제' }),
  ).toHaveLength(0);
});

test('normalizes instagram redirect links before analyzing them', async () => {
  let instance!: ReactTestRenderer.ReactTestRenderer;

  placesApi.listPlaces.mockResolvedValue({
    items: [],
    pageInfo: {
      nextCursor: null,
      hasNext: false,
    },
  });
  discoverApi.discoverPlacesFromLink.mockResolvedValue({
    analysis: defaultDiscoverAnalysis,
    items: [],
    page: {
      contentPreview: '',
      description: null,
      locationHints: [],
      title: null,
      url: 'https://www.instagram.com/p/DWBK956jR0X/?img_index=1',
    },
    queryHints: [],
  });

  await ReactTestRenderer.act(async () => {
    instance = ReactTestRenderer.create(
      <LanguageProvider>
        <DiscoverScreen onScheduleCreated={() => undefined} />
      </LanguageProvider>,
    );
  });

  await ReactTestRenderer.act(async () => {
    await Promise.resolve();
  });

  await ReactTestRenderer.act(async () => {
    instance.root
      .findByProps({ testID: 'discover-link-input' })
      .props.onChangeText(
        'https://l.instagram.com/?u=https%3A%2F%2Fwww.instagram.com%2Fp%2FDWBK956jR0X%2F%3Fimg_index%3D1&is_from_rle=1',
      );
  });

  await ReactTestRenderer.act(async () => {
    instance.root
      .findByProps({ testID: 'discover-link-submit' })
      .props.onPress();
  });

  expect(discoverApi.discoverPlacesFromLink).toHaveBeenCalledWith(
    expect.any(Function),
    'https://www.instagram.com/p/DWBK956jR0X/?img_index=1',
  );
});

test('handles an incoming discover link request automatically', async () => {
  let instance!: ReactTestRenderer.ReactTestRenderer;
  const onIncomingLinkHandled = jest.fn();

  placesApi.listPlaces.mockResolvedValue({
    items: [],
    pageInfo: {
      nextCursor: null,
      hasNext: false,
    },
  });
  discoverApi.discoverPlacesFromLink.mockResolvedValue({
    analysis: defaultDiscoverAnalysis,
    items: [],
    page: {
      contentPreview: '',
      description: null,
      locationHints: [],
      title: null,
      url: 'https://www.instagram.com/p/DWBK956jR0X/?img_index=1',
    },
    queryHints: [],
  });

  await ReactTestRenderer.act(async () => {
    instance = ReactTestRenderer.create(
      <LanguageProvider>
        <DiscoverScreen
          incomingLinkRequest={{
            key: 1,
            url: 'https://l.instagram.com/?u=https%3A%2F%2Fwww.instagram.com%2Fp%2FDWBK956jR0X%2F%3Fimg_index%3D1&is_from_rle=1',
          }}
          onIncomingLinkHandled={onIncomingLinkHandled}
          onScheduleCreated={() => undefined}
        />
      </LanguageProvider>,
    );
  });

  await ReactTestRenderer.act(async () => {
    await Promise.resolve();
  });

  expect(onIncomingLinkHandled).toHaveBeenCalledWith(1);
  expect(discoverApi.discoverPlacesFromLink).toHaveBeenCalledWith(
    expect.any(Function),
    'https://www.instagram.com/p/DWBK956jR0X/?img_index=1',
  );
  expect(
    instance.root.findByProps({ testID: 'discover-link-input' }).props.value,
  ).toBe('https://www.instagram.com/p/DWBK956jR0X/?img_index=1');
});

test('allows saving a matched place suggestion', async () => {
  let instance!: ReactTestRenderer.ReactTestRenderer;

  placesApi.listPlaces.mockResolvedValue({
    items: [],
    pageInfo: {
      nextCursor: null,
      hasNext: false,
    },
  });
  placesApi.savePlace.mockResolvedValue({
    id: 'saved-place-1',
  });
  discoverApi.discoverPlacesFromLink.mockResolvedValue({
    analysis: defaultDiscoverAnalysis,
    items: [
      {
        address: '서울 종로구 자하문로1길 15',
        lat: 37.57712,
        lng: 126.9724,
        mapUrl: 'https://place.map.kakao.com/123456789',
        matchConfidence: 'high',
        matchReasons: [
          {
            query: '오일제',
            type: 'query',
          },
          {
            location: '서울',
            type: 'location',
          },
          {
            rank: 1,
            type: 'searchRank',
          },
        ],
        matchedQuery: '오일제',
        name: '오일제',
        locationHint: '서울',
        provider: 'kakao',
        providerPlaceId: '123456789',
      },
    ],
    page: {
      contentPreview: '서울 빕 구르망 리스트입니다.',
      description: '서울 빕 구르망 리스트입니다.',
      locationHints: ['서울'],
      title: '서울 빕 구르망 리스트',
      url: 'https://www.instagram.com/p/example/',
    },
    queryHints: ['오일제'],
  });

  await ReactTestRenderer.act(async () => {
    instance = ReactTestRenderer.create(
      <LanguageProvider>
        <DiscoverScreen onScheduleCreated={() => undefined} />
      </LanguageProvider>,
    );
  });

  await ReactTestRenderer.act(async () => {
    await Promise.resolve();
  });

  await ReactTestRenderer.act(async () => {
    instance.root
      .findByProps({ testID: 'discover-link-input' })
      .props.onChangeText('https://www.instagram.com/p/example/');
  });

  await ReactTestRenderer.act(async () => {
    instance.root
      .findByProps({ testID: 'discover-link-submit' })
      .props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    instance.root
      .findByProps({ testID: 'discover-link-save-123456789' })
      .props.onPress();
  });

  expect(placesApi.savePlace).toHaveBeenCalledWith(
    expect.any(Function),
    expect.objectContaining({
      address: '서울 종로구 자하문로1길 15',
      lat: 37.57712,
      lng: 126.9724,
      mapUrl: 'https://place.map.kakao.com/123456789',
      name: '오일제',
      provider: 'kakao',
      providerPlaceId: '123456789',
    }),
  );

  const texts = getAllTexts(instance.root);

  expect(texts).toContain('Saved');
});

test('creates a schedule from a discovered place and auto-saves it when needed', async () => {
  let instance!: ReactTestRenderer.ReactTestRenderer;
  const handleScheduleCreated = jest.fn();

  placesApi.listPlaces.mockResolvedValue({
    items: [],
    pageInfo: {
      nextCursor: null,
      hasNext: false,
    },
  });
  placesApi.savePlace.mockResolvedValue({
    id: 'saved-place-1',
  });
  schedulesApi.createSchedule.mockResolvedValue({
    id: 'schedule-1',
  });
  discoverApi.discoverPlacesFromLink.mockResolvedValue({
    analysis: defaultDiscoverAnalysis,
    items: [
      {
        address: '서울 종로구 자하문로1길 15',
        lat: 37.57712,
        lng: 126.9724,
        mapUrl: 'https://place.map.kakao.com/123456789',
        matchConfidence: 'high',
        matchReasons: [
          {
            query: '오일제',
            type: 'query',
          },
          {
            location: '서울',
            type: 'location',
          },
          {
            rank: 1,
            type: 'searchRank',
          },
        ],
        matchedQuery: '오일제',
        name: '오일제',
        locationHint: '서울',
        provider: 'kakao',
        providerPlaceId: '123456789',
      },
    ],
    page: {
      contentPreview: '서울 빕 구르망 리스트입니다.',
      description: '서울 빕 구르망 리스트입니다.',
      locationHints: ['서울'],
      title: '서울 빕 구르망 리스트',
      url: 'https://www.instagram.com/p/example/',
    },
    queryHints: ['오일제'],
  });

  await ReactTestRenderer.act(async () => {
    instance = ReactTestRenderer.create(
      <LanguageProvider>
        <DiscoverScreen onScheduleCreated={handleScheduleCreated} />
      </LanguageProvider>,
    );
  });

  await ReactTestRenderer.act(async () => {
    await Promise.resolve();
  });

  await ReactTestRenderer.act(async () => {
    instance.root
      .findByProps({ testID: 'discover-link-input' })
      .props.onChangeText('https://www.instagram.com/p/example/');
  });

  await ReactTestRenderer.act(async () => {
    instance.root
      .findByProps({ testID: 'discover-link-submit' })
      .props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    instance.root
      .findByProps({ testID: 'discover-link-plan-123456789' })
      .props.onPress();
  });

  const texts = getAllTexts(instance.root);

  expect(texts).toContain('Create a schedule from this pick');
  expect(texts).toContain(
    'Creating the schedule will save this place to Places first, then link it.',
  );

  await ReactTestRenderer.act(async () => {
    instance.root
      .findByProps({ testID: 'discover-plan-title-input' })
      .props.onChangeText('Breakfast at 오일제');
    instance.root
      .findByProps({ testID: 'discover-plan-date-input' })
      .props.onChangeText('2026-04-15 09:30');
    instance.root
      .findByProps({ testID: 'discover-plan-memo-input' })
      .props.onChangeText('Window seat');
  });

  await ReactTestRenderer.act(async () => {
    instance.root.findByProps({ testID: 'discover-plan-submit' }).props.onPress();
  });

  expect(placesApi.savePlace).toHaveBeenCalledWith(
    expect.any(Function),
    expect.objectContaining({
      name: '오일제',
      provider: 'kakao',
      providerPlaceId: '123456789',
    }),
  );
  expect(schedulesApi.createSchedule).toHaveBeenCalledWith(
    expect.any(Function),
    expect.objectContaining({
      memo: 'Window seat',
      placeId: 'saved-place-1',
      title: 'Breakfast at 오일제',
    }),
  );
  expect(handleScheduleCreated).toHaveBeenCalledWith('2026-04-15');
});
