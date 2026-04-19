import React from 'react';
import { Alert, Text, TextInput } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import { PlacesScreen } from '../src/features/places/screens/PlacesScreen';
import { ApiError } from '../src/shared/api/http';
import { LanguageProvider } from '../src/shared/i18n/LanguageContext';

jest.mock('../src/features/auth/context/AuthContext', () => ({
  useAuth: () => ({
    authorizedRequest: jest.fn(),
  }),
}));

jest.mock('../src/features/places/api/placesApi', () => ({
  addPlaceToCollection: jest.fn(),
  createPlaceCollection: jest.fn(),
  deletePlaceCollection: jest.fn(),
  deletePlace: jest.fn(),
  getPlace: jest.fn(),
  listPlaceCollections: jest.fn(),
  listPlaces: jest.fn(),
  removePlaceFromCollection: jest.fn(),
  updatePlace: jest.fn(),
  savePlace: jest.fn(),
  searchPlaces: jest.fn(),
}));

const placesApi = jest.requireMock('../src/features/places/api/placesApi') as {
  addPlaceToCollection: jest.Mock;
  createPlaceCollection: jest.Mock;
  deletePlaceCollection: jest.Mock;
  deletePlace: jest.Mock;
  getPlace: jest.Mock;
  listPlaceCollections: jest.Mock;
  listPlaces: jest.Mock;
  removePlaceFromCollection: jest.Mock;
  savePlace: jest.Mock;
  searchPlaces: jest.Mock;
  updatePlace: jest.Mock;
};

const alertSpy = jest.spyOn(Alert, 'alert');

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

beforeEach(() => {
  placesApi.listPlaceCollections.mockResolvedValue({
    items: [],
    pageInfo: {
      nextCursor: null,
      hasNext: false,
    },
  });
});

afterEach(() => {
  alertSpy.mockClear();
  placesApi.addPlaceToCollection.mockReset();
  placesApi.createPlaceCollection.mockReset();
  placesApi.deletePlaceCollection.mockReset();
  placesApi.deletePlace.mockReset();
  placesApi.getPlace.mockReset();
  placesApi.listPlaceCollections.mockReset();
  placesApi.listPlaces.mockReset();
  placesApi.removePlaceFromCollection.mockReset();
  placesApi.savePlace.mockReset();
  placesApi.searchPlaces.mockReset();
  placesApi.updatePlace.mockReset();
});

function confirmLatestAlertAction() {
  const latestCall = alertSpy.mock.calls[alertSpy.mock.calls.length - 1];
  const buttons = latestCall?.[2] as
    | Array<{ onPress?: () => void }>
    | undefined;
  const confirmButton = buttons ? buttons[buttons.length - 1] : undefined;

  confirmButton?.onPress?.();
}

test('keeps the search screen quiet on first render', async () => {
  let instance!: ReactTestRenderer.ReactTestRenderer;

  placesApi.listPlaces.mockResolvedValue({
    items: [
      {
        address: '서울 성동구 연무장길 1',
        id: 'plc_1',
        lat: 37.544,
        lng: 127.055,
        name: 'Cafe Alpha',
        note: null,
        isFavorite: false,
        provider: 'naver',
        providerPlaceId: 'naver_1',
        savedAt: '2026-03-16T10:00:00.000Z',
        createdAt: '2026-03-16T10:00:00.000Z',
        updatedAt: '2026-03-16T10:00:00.000Z',
      },
    ],
  });

  await ReactTestRenderer.act(async () => {
    instance = ReactTestRenderer.create(
      <LanguageProvider>
        <PlacesScreen />
      </LanguageProvider>,
    );
  });

  await ReactTestRenderer.act(async () => {
    await Promise.resolve();
  });

  expect(instance.root.findByType(TextInput).props.value).toBe('');
  expect(getAllTexts(instance.root)).toContain('Search');
  expect(getAllTexts(instance.root)).toContain('Provider results 0');
  expect(
    getAllTexts(instance.root).filter(text => text === 'Cafe Alpha'),
  ).toHaveLength(1);
});

test('runs a search from the explicit search button and shows provider cards', async () => {
  let instance!: ReactTestRenderer.ReactTestRenderer;

  placesApi.listPlaces.mockResolvedValue({
    items: [],
  });
  placesApi.searchPlaces.mockResolvedValue([
    {
      address: '서울 성동구 연무장길 10',
      lat: 37.544,
      lng: 127.056,
      name: 'Beta Bistro',
      provider: 'kakao',
      providerPlaceId: 'kakao_1',
    },
  ]);

  await ReactTestRenderer.act(async () => {
    instance = ReactTestRenderer.create(
      <LanguageProvider>
        <PlacesScreen />
      </LanguageProvider>,
    );
  });

  await ReactTestRenderer.act(async () => {
    await Promise.resolve();
  });

  await ReactTestRenderer.act(async () => {
    instance.root.findByType(TextInput).props.onChangeText('성수');
  });

  await ReactTestRenderer.act(async () => {
    instance.root.findByProps({ testID: 'places-search-button' }).props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    await Promise.resolve();
  });

  expect(placesApi.searchPlaces).toHaveBeenCalledWith(
    expect.any(Function),
    '성수',
  );
  expect(getAllTexts(instance.root)).toContain('Beta Bistro');
  expect(getAllTexts(instance.root)).toContain('KAKAO');
});

test('opens a search result detail page when a result card is selected', async () => {
  let instance!: ReactTestRenderer.ReactTestRenderer;

  placesApi.listPlaces.mockResolvedValue({
    items: [],
  });
  placesApi.searchPlaces.mockResolvedValue([
    {
      address: '서울 성동구 연무장길 10',
      categoryGroupName: '음식점',
      categoryName: '음식점 > 양식 > 브런치',
      lat: 37.544,
      lng: 127.056,
      mapUrl: 'https://place.map.kakao.com/123456',
      name: 'Beta Bistro',
      phone: '02-1234-5678',
      provider: 'kakao',
      providerPlaceId: 'kakao_1',
      roadAddress: '서울 성동구 서울숲길 10',
    },
  ]);

  await ReactTestRenderer.act(async () => {
    instance = ReactTestRenderer.create(
      <LanguageProvider>
        <PlacesScreen mode="search" />
      </LanguageProvider>,
    );
  });

  await ReactTestRenderer.act(async () => {
    await Promise.resolve();
  });

  await ReactTestRenderer.act(async () => {
    instance.root.findByType(TextInput).props.onChangeText('성수');
  });

  await ReactTestRenderer.act(async () => {
    instance.root.findByProps({ testID: 'places-search-button' }).props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    await Promise.resolve();
  });

  await ReactTestRenderer.act(async () => {
    instance.root.findByProps({ testID: 'search-result-card-kakao_1' }).props.onPress();
  });

  expect(
    instance.root.findByProps({ testID: 'search-result-detail-screen' }),
  ).toBeTruthy();
  expect(getAllTexts(instance.root)).toContain('Search result');
  expect(getAllTexts(instance.root)).toContain('Back to results');
  expect(getAllTexts(instance.root)).toContain('Beta Bistro');
  expect(getAllTexts(instance.root)).toContain('Category');
  expect(getAllTexts(instance.root)).toContain('음식점 > 양식 > 브런치');
  expect(getAllTexts(instance.root)).toContain('Phone');
  expect(getAllTexts(instance.root)).toContain('02-1234-5678');
  expect(getAllTexts(instance.root)).toContain('Road address');
  expect(getAllTexts(instance.root)).toContain('서울 성동구 서울숲길 10');
  expect(getAllTexts(instance.root)).toContain('Open in Kakao Map');
});

test('shows a friendly search feedback message when the provider limit is exceeded', async () => {
  let instance!: ReactTestRenderer.ReactTestRenderer;

  placesApi.listPlaces.mockResolvedValue({
    items: [],
  });
  placesApi.searchPlaces.mockRejectedValue(
    new ApiError({
      status: 429,
      code: 'SEARCH_PROVIDER_LIMIT_EXCEEDED',
      message: 'Kakao place search limit reached',
    }),
  );

  await ReactTestRenderer.act(async () => {
    instance = ReactTestRenderer.create(
      <LanguageProvider>
        <PlacesScreen mode="search" />
      </LanguageProvider>,
    );
  });

  await ReactTestRenderer.act(async () => {
    await Promise.resolve();
  });

  await ReactTestRenderer.act(async () => {
    instance.root.findByType(TextInput).props.onChangeText('은성농원');
  });

  await ReactTestRenderer.act(async () => {
    instance.root.findByProps({ testID: 'places-search-button' }).props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    await Promise.resolve();
  });

  expect(getAllTexts(instance.root)).toContain(
    'Search usage is temporarily capped. Please try again in a little while.',
  );
  expect(getAllTexts(instance.root)).not.toContain(
    'Kakao place search limit reached',
  );
});

test('shows a friendly search feedback message when the provider setup is invalid', async () => {
  let instance!: ReactTestRenderer.ReactTestRenderer;

  placesApi.listPlaces.mockResolvedValue({
    items: [],
  });
  placesApi.searchPlaces.mockRejectedValue(
    new ApiError({
      status: 503,
      code: 'SEARCH_PROVIDER_MISCONFIGURED',
      message: 'Kakao place search is not configured correctly',
    }),
  );

  await ReactTestRenderer.act(async () => {
    instance = ReactTestRenderer.create(
      <LanguageProvider>
        <PlacesScreen mode="search" />
      </LanguageProvider>,
    );
  });

  await ReactTestRenderer.act(async () => {
    await Promise.resolve();
  });

  await ReactTestRenderer.act(async () => {
    instance.root.findByType(TextInput).props.onChangeText('은성농원');
  });

  await ReactTestRenderer.act(async () => {
    instance.root.findByProps({ testID: 'places-search-button' }).props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    await Promise.resolve();
  });

  expect(getAllTexts(instance.root)).toContain(
    'Search provider setup needs attention. Please check the Kakao app settings.',
  );
  expect(getAllTexts(instance.root)).not.toContain(
    'Kakao place search is not configured correctly',
  );
});

test('renders saved mode as a card gallery without the search composer', async () => {
  let instance!: ReactTestRenderer.ReactTestRenderer;

  placesApi.listPlaces.mockResolvedValue({
    items: [
      {
        address: '서울 용산구 이태원로 10',
        id: 'plc_1',
        lat: 37.533,
        lng: 126.994,
        name: 'Harbor Table',
        note: null,
        isFavorite: true,
        provider: 'kakao',
        providerPlaceId: 'kakao_1',
        savedAt: '2026-03-20T10:00:00.000Z',
        createdAt: '2026-03-20T10:00:00.000Z',
        updatedAt: '2026-03-20T10:00:00.000Z',
      },
      {
        address: '서울 성동구 성수이로 22',
        id: 'plc_2',
        lat: 37.545,
        lng: 127.056,
        name: 'Garden Room',
        note: null,
        isFavorite: false,
        provider: 'naver',
        providerPlaceId: 'naver_2',
        savedAt: '2026-03-22T09:00:00.000Z',
        createdAt: '2026-03-22T09:00:00.000Z',
        updatedAt: '2026-03-22T09:00:00.000Z',
      },
    ],
  });

  await ReactTestRenderer.act(async () => {
    instance = ReactTestRenderer.create(
      <LanguageProvider>
        <PlacesScreen mode="saved" />
      </LanguageProvider>,
    );
  });

  await ReactTestRenderer.act(async () => {
    await Promise.resolve();
  });

  expect(instance.root.findAllByProps({ testID: 'places-search-button' })).toHaveLength(0);
  expect(getAllTexts(instance.root)).toContain('Saved');
  expect(getAllTexts(instance.root)).toContain('Recommended');
  expect(getAllTexts(instance.root)).toContain('Recently viewed');
  expect(getAllTexts(instance.root)).toContain('New collection');
  expect(getAllTexts(instance.root)).toContain('Saved places 2');
  expect(instance.root.findByProps({ testID: 'saved-place-card-plc_1' })).toBeTruthy();
  expect(instance.root.findByProps({ testID: 'saved-place-card-plc_2' })).toBeTruthy();
  expect(
    instance.root.findByProps({ testID: 'saved-recent-collection-card' }),
  ).toBeTruthy();
  expect(
    instance.root.findByProps({ testID: 'saved-recent-collection-preview' }),
  ).toBeTruthy();
  expect(
    instance.root.findByProps({ testID: 'saved-place-cover-grid-plc_1' }),
  ).toBeTruthy();
});

test('creates a saved collection from the saved tab', async () => {
  let instance!: ReactTestRenderer.ReactTestRenderer;

  placesApi.listPlaces.mockResolvedValue({
    items: [
      {
        address: '서울 성동구 성수이로 22',
        id: 'plc_2',
        lat: 37.545,
        lng: 127.056,
        name: 'Garden Room',
        note: null,
        isFavorite: false,
        provider: 'naver',
        providerPlaceId: 'naver_2',
        savedAt: '2026-03-22T09:00:00.000Z',
        createdAt: '2026-03-22T09:00:00.000Z',
        updatedAt: '2026-03-22T09:00:00.000Z',
      },
    ],
  });
  placesApi.createPlaceCollection.mockResolvedValue({
    id: 'col_1',
    name: '성수 브런치',
    placeIds: [],
    createdAt: '2026-03-22T09:00:00.000Z',
    updatedAt: '2026-03-22T09:00:00.000Z',
  });

  await ReactTestRenderer.act(async () => {
    instance = ReactTestRenderer.create(
      <LanguageProvider>
        <PlacesScreen mode="saved" />
      </LanguageProvider>,
    );
  });

  await ReactTestRenderer.act(async () => {
    await Promise.resolve();
  });

  await ReactTestRenderer.act(async () => {
    instance.root
      .findByProps({ testID: 'saved-collection-start-create-button' })
      .props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    instance.root
      .findByProps({ testID: 'saved-collection-name-input' })
      .props.onChangeText('성수 브런치');
  });

  await ReactTestRenderer.act(async () => {
    instance.root
      .findByProps({ testID: 'saved-collection-create-button' })
      .props.onPress();
  });

  expect(placesApi.createPlaceCollection).toHaveBeenCalledWith(
    expect.any(Function),
    {
      name: '성수 브런치',
    },
  );
  expect(getAllTexts(instance.root)).toContain('성수 브런치');
});

test('deletes a selected saved collection from the saved tab', async () => {
  let instance!: ReactTestRenderer.ReactTestRenderer;

  placesApi.listPlaces.mockResolvedValue({
    items: [
      {
        address: '서울 성동구 성수이로 22',
        id: 'plc_2',
        lat: 37.545,
        lng: 127.056,
        name: 'Garden Room',
        note: null,
        isFavorite: false,
        provider: 'naver',
        providerPlaceId: 'naver_2',
        savedAt: '2026-03-22T09:00:00.000Z',
        createdAt: '2026-03-22T09:00:00.000Z',
        updatedAt: '2026-03-22T09:00:00.000Z',
      },
    ],
  });
  placesApi.listPlaceCollections.mockResolvedValue({
    items: [
      {
        id: 'col_1',
        name: '성수 브런치',
        placeIds: ['plc_2'],
        createdAt: '2026-03-22T09:00:00.000Z',
        updatedAt: '2026-03-22T09:00:00.000Z',
      },
    ],
    pageInfo: {
      nextCursor: null,
      hasNext: false,
    },
  });
  placesApi.deletePlaceCollection.mockResolvedValue(undefined);

  await ReactTestRenderer.act(async () => {
    instance = ReactTestRenderer.create(
      <LanguageProvider>
        <PlacesScreen mode="saved" />
      </LanguageProvider>,
    );
  });

  await ReactTestRenderer.act(async () => {
    await Promise.resolve();
  });

  await ReactTestRenderer.act(async () => {
    instance.root
      .findByProps({ testID: 'saved-collection-card-col_1' })
      .props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    instance.root
      .findByProps({ testID: 'saved-collection-delete-button' })
      .props.onPress();
  });

  expect(alertSpy).toHaveBeenCalledWith(
    'Delete this collection?',
    'Places stay saved, but this collection will be removed.',
    expect.any(Array),
  );

  await ReactTestRenderer.act(async () => {
    confirmLatestAlertAction();
  });

  expect(placesApi.deletePlaceCollection).toHaveBeenCalledWith(
    expect.any(Function),
    'col_1',
  );
  expect(getAllTexts(instance.root)).toContain('Collection deleted.');
  expect(
    instance.root.findAllByProps({ testID: 'saved-collection-card-col_1' }),
  ).toHaveLength(0);
});

test('renders saved mode even when Intl.RelativeTimeFormat is unavailable', async () => {
  let instance!: ReactTestRenderer.ReactTestRenderer;
  const originalRelativeTimeFormat = Intl.RelativeTimeFormat;

  Object.defineProperty(Intl, 'RelativeTimeFormat', {
    configurable: true,
    value: undefined,
  });

  placesApi.listPlaces.mockResolvedValue({
    items: [
      {
        address: '서울 성동구 성수이로 22',
        id: 'plc_2',
        lat: 37.545,
        lng: 127.056,
        name: 'Garden Room',
        note: null,
        isFavorite: false,
        provider: 'naver',
        providerPlaceId: 'naver_2',
        savedAt: '2026-03-22T09:00:00.000Z',
        createdAt: '2026-03-22T09:00:00.000Z',
        updatedAt: '2026-03-22T09:00:00.000Z',
      },
    ],
  });

  try {
    await ReactTestRenderer.act(async () => {
      instance = ReactTestRenderer.create(
        <LanguageProvider>
          <PlacesScreen mode="saved" />
        </LanguageProvider>,
      );
    });

    await ReactTestRenderer.act(async () => {
      await Promise.resolve();
    });

    expect(getAllTexts(instance.root)).toContain('Garden Room');
    expect(getAllTexts(instance.root)).toContain('Recently viewed');
  } finally {
    Object.defineProperty(Intl, 'RelativeTimeFormat', {
      configurable: true,
      value: originalRelativeTimeFormat,
    });
  }
});

test('opens a dedicated detail page when a saved card is selected in saved mode', async () => {
  let instance!: ReactTestRenderer.ReactTestRenderer;

  placesApi.listPlaces.mockResolvedValue({
    items: [
      {
        address: '서울 성동구 성수이로 22',
        id: 'plc_2',
        lat: 37.545,
        lng: 127.056,
        name: 'Garden Room',
        note: null,
        isFavorite: false,
        provider: 'naver',
        providerPlaceId: 'naver_2',
        savedAt: '2026-03-22T09:00:00.000Z',
        createdAt: '2026-03-22T09:00:00.000Z',
        updatedAt: '2026-03-22T09:00:00.000Z',
      },
    ],
  });
  placesApi.getPlace.mockResolvedValue({
    address: '서울 성동구 성수이로 22',
    categoryGroupName: '음식점',
    categoryName: '음식점 > 브런치카페',
    id: 'plc_2',
    lat: 37.545,
    lng: 127.056,
    mapUrl: 'https://place.map.kakao.com/2222',
    name: 'Garden Room',
    note: null,
    phone: '02-2222-3333',
    isFavorite: false,
    provider: 'naver',
    providerPlaceId: 'naver_2',
    roadAddress: '서울 성동구 성수이로 22',
    savedAt: '2026-03-22T09:00:00.000Z',
    createdAt: '2026-03-22T09:00:00.000Z',
    updatedAt: '2026-03-22T09:00:00.000Z',
  });

  await ReactTestRenderer.act(async () => {
    instance = ReactTestRenderer.create(
      <LanguageProvider>
        <PlacesScreen mode="saved" />
      </LanguageProvider>,
    );
  });

  await ReactTestRenderer.act(async () => {
    await Promise.resolve();
  });

  await ReactTestRenderer.act(async () => {
    instance.root.findByProps({ testID: 'saved-place-card-plc_2' }).props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    await Promise.resolve();
  });

  expect(
    instance.root.findByProps({ testID: 'saved-place-detail-screen' }),
  ).toBeTruthy();
  expect(getAllTexts(instance.root)).toContain('Back to saved places');
  expect(getAllTexts(instance.root)).toContain('Garden Room');
  expect(getAllTexts(instance.root)).toContain('음식점 > 브런치카페');

  await ReactTestRenderer.act(async () => {
    instance.root
      .findByProps({ testID: 'saved-place-detail-back-button' })
      .props.onPress();
  });

  expect(
    instance.root.findByProps({ testID: 'saved-place-card-plc_2' }),
  ).toBeTruthy();
});

test('requests a calendar draft from a saved place detail page', async () => {
  let instance!: ReactTestRenderer.ReactTestRenderer;
  const handleCreateScheduleForPlace = jest.fn();

  placesApi.listPlaces.mockResolvedValue({
    items: [
      {
        address: '서울 성동구 성수이로 22',
        id: 'plc_2',
        lat: 37.545,
        lng: 127.056,
        name: 'Garden Room',
        note: null,
        isFavorite: false,
        provider: 'naver',
        providerPlaceId: 'naver_2',
        savedAt: '2026-03-22T09:00:00.000Z',
        createdAt: '2026-03-22T09:00:00.000Z',
        updatedAt: '2026-03-22T09:00:00.000Z',
      },
    ],
  });
  placesApi.getPlace.mockResolvedValue({
    address: '서울 성동구 성수이로 22',
    categoryGroupName: '음식점',
    categoryName: '음식점 > 브런치카페',
    id: 'plc_2',
    lat: 37.545,
    lng: 127.056,
    mapUrl: 'https://place.map.kakao.com/2222',
    name: 'Garden Room',
    note: null,
    phone: '02-2222-3333',
    isFavorite: false,
    provider: 'naver',
    providerPlaceId: 'naver_2',
    roadAddress: '서울 성동구 성수이로 22',
    savedAt: '2026-03-22T09:00:00.000Z',
    createdAt: '2026-03-22T09:00:00.000Z',
    updatedAt: '2026-03-22T09:00:00.000Z',
  });

  await ReactTestRenderer.act(async () => {
    instance = ReactTestRenderer.create(
      <LanguageProvider>
        <PlacesScreen
          mode="saved"
          onCreateScheduleForPlace={handleCreateScheduleForPlace}
        />
      </LanguageProvider>,
    );
  });

  await ReactTestRenderer.act(async () => {
    await Promise.resolve();
  });

  await ReactTestRenderer.act(async () => {
    instance.root.findByProps({ testID: 'saved-place-card-plc_2' }).props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    await Promise.resolve();
  });

  expect(getAllTexts(instance.root)).toContain('Add to calendar');

  await ReactTestRenderer.act(async () => {
    instance.root
      .findByProps({ testID: 'saved-place-schedule-button' })
      .props.onPress();
  });

  expect(handleCreateScheduleForPlace).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 'plc_2',
      name: 'Garden Room',
    }),
  );
});

test('toggles a saved place into a collection from the detail page', async () => {
  let instance!: ReactTestRenderer.ReactTestRenderer;

  placesApi.listPlaces.mockResolvedValue({
    items: [
      {
        address: '서울 성동구 성수이로 22',
        id: 'plc_2',
        lat: 37.545,
        lng: 127.056,
        name: 'Garden Room',
        note: null,
        isFavorite: false,
        provider: 'naver',
        providerPlaceId: 'naver_2',
        savedAt: '2026-03-22T09:00:00.000Z',
        createdAt: '2026-03-22T09:00:00.000Z',
        updatedAt: '2026-03-22T09:00:00.000Z',
      },
    ],
  });
  placesApi.listPlaceCollections.mockResolvedValue({
    items: [
      {
        id: 'col_1',
        name: '성수 브런치',
        placeIds: [],
        createdAt: '2026-03-22T09:00:00.000Z',
        updatedAt: '2026-03-22T09:00:00.000Z',
      },
    ],
    pageInfo: {
      nextCursor: null,
      hasNext: false,
    },
  });
  placesApi.getPlace.mockResolvedValue({
    address: '서울 성동구 성수이로 22',
    categoryGroupName: '음식점',
    categoryName: '음식점 > 브런치카페',
    id: 'plc_2',
    lat: 37.545,
    lng: 127.056,
    mapUrl: 'https://place.map.kakao.com/2222',
    name: 'Garden Room',
    note: null,
    phone: '02-2222-3333',
    isFavorite: false,
    provider: 'naver',
    providerPlaceId: 'naver_2',
    roadAddress: '서울 성동구 성수이로 22',
    savedAt: '2026-03-22T09:00:00.000Z',
    createdAt: '2026-03-22T09:00:00.000Z',
    updatedAt: '2026-03-22T09:00:00.000Z',
  });
  placesApi.addPlaceToCollection.mockResolvedValue({
    id: 'col_1',
    name: '성수 브런치',
    placeIds: ['plc_2'],
    createdAt: '2026-03-22T09:00:00.000Z',
    updatedAt: '2026-03-22T09:30:00.000Z',
  });

  await ReactTestRenderer.act(async () => {
    instance = ReactTestRenderer.create(
      <LanguageProvider>
        <PlacesScreen mode="saved" />
      </LanguageProvider>,
    );
  });

  await ReactTestRenderer.act(async () => {
    await Promise.resolve();
  });

  await ReactTestRenderer.act(async () => {
    instance.root.findByProps({ testID: 'saved-place-card-plc_2' }).props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    await Promise.resolve();
  });

  await ReactTestRenderer.act(async () => {
    instance.root
      .findByProps({ testID: 'place-collection-chip-col_1' })
      .props.onPress();
  });

  expect(placesApi.addPlaceToCollection).toHaveBeenCalledWith(
    expect.any(Function),
    {
      collectionId: 'col_1',
      placeId: 'plc_2',
    },
  );
  expect(getAllTexts(instance.root)).toContain('Added to collection.');
});

test('updates and deletes a saved place from the detail panel', async () => {
  let instance!: ReactTestRenderer.ReactTestRenderer;

  placesApi.listPlaces.mockResolvedValue({
    items: [
      {
        address: '서울 성동구 연무장길 1',
        id: 'plc_1',
        lat: 37.544,
        lng: 127.055,
        name: 'Cafe Alpha',
        note: null,
        isFavorite: false,
        provider: 'naver',
        providerPlaceId: 'naver_1',
        savedAt: '2026-03-16T10:00:00.000Z',
        createdAt: '2026-03-16T10:00:00.000Z',
        updatedAt: '2026-03-16T10:00:00.000Z',
      },
    ],
  });
  placesApi.getPlace.mockResolvedValue({
    address: '서울 성동구 연무장길 1',
    categoryGroupName: '음식점',
    categoryName: '음식점 > 한식 > 국밥',
    id: 'plc_1',
    lat: 37.544,
    lng: 127.055,
    mapUrl: 'https://place.map.kakao.com/1111',
    name: 'Cafe Alpha',
    note: null,
    phone: '02-1111-2222',
    isFavorite: false,
    provider: 'naver',
    providerPlaceId: 'naver_1',
    roadAddress: '서울 성동구 연무장길 1',
    savedAt: '2026-03-16T10:00:00.000Z',
    createdAt: '2026-03-16T10:00:00.000Z',
    updatedAt: '2026-03-16T10:00:00.000Z',
  });
  placesApi.updatePlace.mockResolvedValue({
    address: '서울 성동구 연무장길 1',
    categoryGroupName: '음식점',
    categoryName: '음식점 > 한식 > 국밥',
    id: 'plc_1',
    lat: 37.544,
    lng: 127.055,
    mapUrl: 'https://place.map.kakao.com/1111',
    name: 'Cafe Alpha',
    note: 'Window seat',
    phone: '02-1111-2222',
    isFavorite: true,
    provider: 'naver',
    providerPlaceId: 'naver_1',
    roadAddress: '서울 성동구 연무장길 1',
    savedAt: '2026-03-16T10:00:00.000Z',
    createdAt: '2026-03-16T10:00:00.000Z',
    updatedAt: '2026-03-18T09:00:00.000Z',
  });
  placesApi.deletePlace.mockResolvedValue(undefined);

  await ReactTestRenderer.act(async () => {
    instance = ReactTestRenderer.create(
      <LanguageProvider>
        <PlacesScreen />
      </LanguageProvider>,
    );
  });

  await ReactTestRenderer.act(async () => {
    await Promise.resolve();
  });

  await ReactTestRenderer.act(async () => {
    instance.root
      .findByProps({ testID: 'saved-place-row-plc_1' })
      .props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    await Promise.resolve();
  });

  expect(getAllTexts(instance.root)).toContain('Category');
  expect(getAllTexts(instance.root)).toContain('음식점 > 한식 > 국밥');
  expect(getAllTexts(instance.root)).toContain('Phone');
  expect(getAllTexts(instance.root)).toContain('02-1111-2222');
  expect(getAllTexts(instance.root)).toContain('Open in Kakao Map');

  await ReactTestRenderer.act(async () => {
    instance.root
      .findByProps({ testID: 'place-detail-favorite-button' })
      .props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    instance.root
      .findByProps({ testID: 'place-detail-note-input' })
      .props.onChangeText('Window seat');
  });

  await ReactTestRenderer.act(async () => {
    instance.root
      .findByProps({ testID: 'place-detail-save-button' })
      .props.onPress();
  });

  expect(placesApi.updatePlace).toHaveBeenCalledWith(
    expect.any(Function),
    'plc_1',
    {
      note: 'Window seat',
      isFavorite: true,
    },
  );

  await ReactTestRenderer.act(async () => {
    instance.root
      .findByProps({ testID: 'place-detail-delete-button' })
      .props.onPress();
  });

  expect(alertSpy).toHaveBeenCalledWith(
    'Remove this saved place?',
    'This place will be removed from your saved list.',
    expect.any(Array),
  );

  await ReactTestRenderer.act(async () => {
    confirmLatestAlertAction();
  });

  expect(placesApi.deletePlace).toHaveBeenCalledWith(
    expect.any(Function),
    'plc_1',
  );
});
