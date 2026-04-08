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

const placesApi = jest.requireMock('../src/features/places/api/placesApi') as {
  listPlaces: jest.Mock;
  savePlace: jest.Mock;
};
const discoverApi = jest.requireMock(
  '../src/features/discover/api/discoverApi',
) as {
  discoverPlacesFromLink: jest.Mock;
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
    items: [
      {
        address: '서울 성동구 성수이로 78',
        lat: 37.541569,
        lng: 127.055236,
        mapUrl: 'https://place.map.kakao.com/987654321',
        matchedQuery: '성수 카페',
        name: '성수 대림창고',
        locationHint: '성수',
        provider: 'kakao',
        providerPlaceId: '987654321',
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

  expect(texts).toContain('Read a link and surface venue names');
  expect(texts).toContain('성수 카페 투어 가이드');
  expect(texts).toContain('Matched places');
  expect(texts).toContain('성수 대림창고');
  expect(texts).toContain('성수 카페');
  expect(texts).toContain('Open in Kakao Map');
});

test('shows extracted shop names when place matching is not ready yet', async () => {
  let instance!: ReactTestRenderer.ReactTestRenderer;

  placesApi.listPlaces.mockResolvedValue({
    items: [],
    pageInfo: {
      nextCursor: null,
      hasNext: false,
    },
  });
  discoverApi.discoverPlacesFromLink.mockResolvedValue({
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

  expect(texts).toContain('Detected shop names');
  expect(texts).toContain('3대 삼계장인');
  expect(texts).toContain('오일제');
  expect(texts).toContain(
    'Detected from the link, but map matching is not ready for this name yet.',
  );
});

test('allows saving a detected shop name as a candidate place', async () => {
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
    items: [],
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
      .findByProps({ testID: 'discover-link-candidate-save-오일제' })
      .props.onPress();
  });

  expect(placesApi.savePlace).toHaveBeenCalledWith(
    expect.any(Function),
    expect.objectContaining({
      address: expect.stringContaining('서울'),
      lat: 0,
      lng: 0,
      mapUrl: null,
      name: '오일제',
      provider: 'kakao',
      providerPlaceId: expect.stringContaining('discover_'),
    }),
  );

  const texts = getAllTexts(instance.root);

  expect(texts).toContain('Saved');
});
