import React from 'react';
import { Text, TextInput } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import { CalendarScreen } from '../src/features/calendar/screens/CalendarScreen';
import { LanguageProvider } from '../src/shared/i18n/LanguageContext';

const mockAuthorizedRequest = jest.fn();

jest.mock('../src/features/auth/context/AuthContext', () => ({
  useAuth: () => ({
    authorizedRequest: mockAuthorizedRequest,
  }),
}));

jest.mock('../src/features/calendar/api/schedulesApi', () => ({
  createSchedule: jest.fn(),
  deleteSchedule: jest.fn(),
  getSchedule: jest.fn(),
  listSchedules: jest.fn(),
  updateSchedule: jest.fn(),
}));

jest.mock('../src/features/places/api/placesApi', () => ({
  listPlaces: jest.fn(),
}));

const schedulesApi = jest.requireMock('../src/features/calendar/api/schedulesApi') as {
  createSchedule: jest.Mock;
  deleteSchedule: jest.Mock;
  getSchedule: jest.Mock;
  listSchedules: jest.Mock;
  updateSchedule: jest.Mock;
};

const placesApi = jest.requireMock('../src/features/places/api/placesApi') as {
  listPlaces: jest.Mock;
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
  mockAuthorizedRequest.mockReset();
  schedulesApi.createSchedule.mockReset();
  schedulesApi.deleteSchedule.mockReset();
  schedulesApi.getSchedule.mockReset();
  schedulesApi.listSchedules.mockReset();
  schedulesApi.updateSchedule.mockReset();
  placesApi.listPlaces.mockReset();
});

test('opens a schedule editor and saves changes', async () => {
  let instance!: ReactTestRenderer.ReactTestRenderer;

  schedulesApi.listSchedules.mockResolvedValue({
    items: [
      {
        id: 'sch_1',
        placeId: 'plc_1',
        scheduledAt: new Date(2026, 2, 24, 18, 0, 0, 0).toISOString(),
        title: 'Dinner plan',
        visitStatus: 'planned',
      },
    ],
  });
  schedulesApi.getSchedule.mockResolvedValue({
    id: 'sch_1',
    memo: 'window seat',
    placeId: 'plc_1',
    scheduledAt: new Date(2026, 2, 24, 18, 0, 0, 0).toISOString(),
    title: 'Dinner plan',
    visitStatus: 'planned',
  });
  schedulesApi.updateSchedule.mockResolvedValue({
    id: 'sch_1',
    updated: true,
  });
  placesApi.listPlaces.mockResolvedValue({
    items: [
      {
        address: '서울 성동구 연무장길 39-25',
        id: 'plc_1',
        lat: 37.544958,
        lng: 127.055154,
        name: '성수 미도인',
        provider: 'kakao',
        providerPlaceId: 'discover_seongsu-midoin',
        savedAt: '2026-03-20T14:00:00.000Z',
      },
    ],
    pageInfo: {
      nextCursor: null,
      hasNext: false,
    },
  });

  await ReactTestRenderer.act(async () => {
    instance = ReactTestRenderer.create(
      <LanguageProvider>
        <CalendarScreen
          bottomInset={0}
          dataRefreshKey={0}
          focusRequestKey={0}
          requestedDateKey="2026-03-24"
        />
      </LanguageProvider>,
    );
  });

  await ReactTestRenderer.act(async () => {
    await Promise.resolve();
  });

  expect(getAllTexts(instance.root)).toContain('Dinner plan');
  expect(
    instance.root.findByProps({ testID: 'calendar-day-preview-2026-03-24' }).props
      .children,
  ).toBe('Dinner plan');

  await ReactTestRenderer.act(async () => {
    instance.root.findByProps({ testID: 'calendar-agenda-sch_1' }).props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    await Promise.resolve();
  });

  const inputs = instance.root.findAllByType(TextInput);

  await ReactTestRenderer.act(async () => {
    inputs[0].props.onChangeText('Dinner plan updated');
    inputs[1].props.onChangeText('2026-03-24 19:30');
    inputs[2].props.onChangeText('bring notebook');
  });

  await ReactTestRenderer.act(async () => {
    instance.root.findByProps({ testID: 'calendar-save-button' }).props.onPress();
  });

  expect(schedulesApi.updateSchedule).toHaveBeenCalledWith(expect.any(Function), {
    id: 'sch_1',
    memo: 'bring notebook',
    placeId: 'plc_1',
    scheduledAt: new Date(2026, 2, 24, 19, 30, 0, 0).toISOString(),
    title: 'Dinner plan updated',
    visitStatus: 'planned',
  });
});

test('creates a new schedule from the selected calendar date', async () => {
  let instance!: ReactTestRenderer.ReactTestRenderer;

  schedulesApi.listSchedules.mockResolvedValue({
    items: [],
  });
  schedulesApi.createSchedule.mockResolvedValue({
    id: 'sch_new',
  });
  placesApi.listPlaces.mockResolvedValue({
    items: [
      {
        address: '서울 성동구 연무장길 39-25',
        id: 'plc_1',
        lat: 37.544958,
        lng: 127.055154,
        name: '성수 미도인',
        provider: 'kakao',
        providerPlaceId: 'discover_seongsu-midoin',
        savedAt: '2026-03-20T14:00:00.000Z',
      },
    ],
    pageInfo: {
      nextCursor: null,
      hasNext: false,
    },
  });

  await ReactTestRenderer.act(async () => {
    instance = ReactTestRenderer.create(
      <LanguageProvider>
        <CalendarScreen
          bottomInset={0}
          dataRefreshKey={0}
          focusRequestKey={0}
          requestedDateKey="2026-03-25"
        />
      </LanguageProvider>,
    );
  });

  await ReactTestRenderer.act(async () => {
    await Promise.resolve();
  });

  await ReactTestRenderer.act(async () => {
    instance.root.findByProps({ testID: 'calendar-new-button' }).props.onPress();
  });

  const inputs = instance.root.findAllByType(TextInput);

  await ReactTestRenderer.act(async () => {
    inputs[0].props.onChangeText('Quiet lunch');
    inputs[1].props.onChangeText('2026-03-25 12:30');
    inputs[2].props.onChangeText('bring book');
  });

  await ReactTestRenderer.act(async () => {
    instance.root.findByProps({ testID: 'calendar-place-option-plc_1' }).props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    instance.root.findByProps({ testID: 'calendar-save-button' }).props.onPress();
  });

  expect(schedulesApi.createSchedule).toHaveBeenCalledWith(expect.any(Function), {
    memo: 'bring book',
    placeId: 'plc_1',
    scheduledAt: new Date(2026, 2, 25, 12, 30, 0, 0).toISOString(),
    title: 'Quiet lunch',
  });
});

test('opens a day detail screen when selecting a date cell', async () => {
  let instance!: ReactTestRenderer.ReactTestRenderer;

  schedulesApi.listSchedules.mockResolvedValue({
    items: [
      {
        id: 'sch_1',
        placeId: null,
        scheduledAt: new Date(2026, 2, 24, 18, 0, 0, 0).toISOString(),
        title: 'Dinner plan',
        visitStatus: 'planned',
      },
    ],
  });
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
        <CalendarScreen
          bottomInset={0}
          dataRefreshKey={0}
          focusRequestKey={0}
          requestedDateKey="2026-03-24"
        />
      </LanguageProvider>,
    );
  });

  await ReactTestRenderer.act(async () => {
    await Promise.resolve();
  });

  await ReactTestRenderer.act(async () => {
    instance.root.findByProps({ testID: 'calendar-day-2026-03-24' }).props.onPress();
  });

  expect(
    instance.root.findByProps({ testID: 'calendar-day-detail-screen' }),
  ).toBeTruthy();
  expect(getAllTexts(instance.root)).toContain('March 24, 2026');
  expect(getAllTexts(instance.root)).toContain('Dinner plan');

  await ReactTestRenderer.act(async () => {
    instance.root
      .findByProps({ testID: 'calendar-day-detail-back-button' })
      .props.onPress();
  });

  expect(
    instance.root.findByProps({ testID: 'calendar-day-preview-2026-03-24' }).props
      .children,
  ).toBe('Dinner plan');
});
