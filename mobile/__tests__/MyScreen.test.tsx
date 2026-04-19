import React from 'react';
import { Alert, Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import { MyScreen } from '../src/features/my/screens/MyScreen';
import { LanguageProvider } from '../src/shared/i18n/LanguageContext';

jest.mock('../src/features/auth/context/AuthContext', () => ({
  useAuth: () => ({
    authorizedRequest: jest.fn(),
  }),
}));

jest.mock('../src/features/places/api/placesApi', () => ({
  listPlaceCollections: jest.fn(),
  listPlaces: jest.fn(),
}));

jest.mock('../src/features/calendar/api/schedulesApi', () => ({
  listSchedules: jest.fn(),
}));

const placesApi = jest.requireMock('../src/features/places/api/placesApi') as {
  listPlaceCollections: jest.Mock;
  listPlaces: jest.Mock;
};

const schedulesApi = jest.requireMock(
  '../src/features/calendar/api/schedulesApi',
) as {
  listSchedules: jest.Mock;
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

async function flushAsyncWork() {
  await ReactTestRenderer.act(async () => {
    await new Promise<void>(resolve => {
      setTimeout(() => resolve(), 0);
    });
  });

  await ReactTestRenderer.act(async () => {
    await new Promise<void>(resolve => {
      setTimeout(() => resolve(), 0);
    });
  });
}

afterEach(() => {
  alertSpy.mockClear();
  placesApi.listPlaceCollections.mockReset();
  placesApi.listPlaces.mockReset();
  schedulesApi.listSchedules.mockReset();
});

test('renders account summary cards from saved places, collections, and schedules', async () => {
  let instance!: ReactTestRenderer.ReactTestRenderer;

  placesApi.listPlaces.mockResolvedValue({
    items: [
      {
        address: '서울 중구 충무로 50-1',
        id: 'plc_1',
        isFavorite: true,
        lat: 37.5657,
        lng: 126.9929,
        name: '은성농원',
        note: null,
        provider: 'kakao',
        providerPlaceId: '711010192',
        savedAt: '2026-04-01T09:00:00.000Z',
        createdAt: '2026-04-01T09:00:00.000Z',
        updatedAt: '2026-04-01T09:00:00.000Z',
      },
      {
        address: '서울 성동구 성수이로 22',
        id: 'plc_2',
        isFavorite: false,
        lat: 37.545,
        lng: 127.056,
        name: 'Garden Room',
        note: null,
        provider: 'naver',
        providerPlaceId: 'naver_2',
        savedAt: '2026-04-02T09:00:00.000Z',
        createdAt: '2026-04-02T09:00:00.000Z',
        updatedAt: '2026-04-02T09:00:00.000Z',
      },
    ],
  });
  placesApi.listPlaceCollections.mockResolvedValue({
    items: [
      {
        id: 'col_1',
        name: '성수 브런치',
        placeIds: ['plc_2'],
        createdAt: '2026-04-02T09:00:00.000Z',
        updatedAt: '2026-04-02T09:00:00.000Z',
      },
    ],
    pageInfo: {
      nextCursor: null,
      hasNext: false,
    },
  });
  schedulesApi.listSchedules.mockResolvedValue({
    items: [
      {
        id: 'sch_1',
        placeId: 'plc_2',
        reminderMinutesBefore: null,
        scheduledAt: '2099-04-12T10:00:00.000Z',
        title: '브런치 약속',
        visitStatus: 'planned',
      },
      {
        id: 'sch_2',
        placeId: 'plc_1',
        reminderMinutesBefore: null,
        scheduledAt: '2099-04-13T10:00:00.000Z',
        title: '건너뛴 일정',
        visitStatus: 'skipped',
      },
    ],
  });

  await ReactTestRenderer.act(async () => {
    instance = ReactTestRenderer.create(
      <LanguageProvider>
        <MyScreen email="hello@eerspot.app" onSignOut={async () => undefined} />
      </LanguageProvider>,
    );
  });

  await flushAsyncWork();

  expect(getAllTexts(instance.root)).toContain('hello');
  expect(getAllTexts(instance.root)).toContain('Saved places');
  expect(getAllTexts(instance.root)).toContain('Collections');
  expect(getAllTexts(instance.root)).toContain('Favorites');
  expect(getAllTexts(instance.root)).toContain('Upcoming plans');
  expect(getAllTexts(instance.root)).toContain('Notifications');
  expect(getAllTexts(instance.root)).toContain('In-app reminders');
  expect(getAllTexts(instance.root)).toContain('Status: Up to date');
  expect(placesApi.listPlaces).toHaveBeenCalledTimes(1);
  expect(placesApi.listPlaceCollections).toHaveBeenCalledTimes(1);
  expect(schedulesApi.listSchedules).toHaveBeenCalledTimes(1);
});

test('runs sign out from the profile action button', async () => {
  let instance!: ReactTestRenderer.ReactTestRenderer;
  const handleSignOut = jest.fn(async () => undefined);

  placesApi.listPlaces.mockResolvedValue({
    items: [],
  });
  placesApi.listPlaceCollections.mockResolvedValue({
    items: [],
    pageInfo: {
      nextCursor: null,
      hasNext: false,
    },
  });
  schedulesApi.listSchedules.mockResolvedValue({
    items: [],
  });

  await ReactTestRenderer.act(async () => {
    instance = ReactTestRenderer.create(
      <LanguageProvider>
        <MyScreen email="hello@eerspot.app" onSignOut={handleSignOut} />
      </LanguageProvider>,
    );
  });

  await flushAsyncWork();

  await ReactTestRenderer.act(async () => {
    instance.root.findByProps({ testID: 'my-sign-out-button' }).props.onPress();
  });

  expect(alertSpy).toHaveBeenCalledWith(
    'Sign out now?',
    'You can sign back in anytime with the same account.',
    expect.any(Array),
  );
  expect(handleSignOut).toHaveBeenCalledTimes(0);

  await ReactTestRenderer.act(async () => {
    const latestCall = alertSpy.mock.calls[alertSpy.mock.calls.length - 1];
    const buttons = latestCall?.[2] as
      | Array<{ onPress?: () => void }>
      | undefined;
    const confirmButton = buttons ? buttons[buttons.length - 1] : undefined;

    confirmButton?.onPress?.();
  });

  expect(handleSignOut).toHaveBeenCalledTimes(1);
});
