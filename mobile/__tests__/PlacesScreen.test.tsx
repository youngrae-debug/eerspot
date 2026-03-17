import React from 'react';
import { Text, TextInput } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import { PlacesScreen } from '../src/features/places/screens/PlacesScreen';
import { LanguageProvider } from '../src/shared/i18n/LanguageContext';

jest.mock('../src/features/auth/context/AuthContext', () => ({
  useAuth: () => ({
    authorizedRequest: jest.fn(),
  }),
}));

jest.mock('../src/features/places/api/placesApi', () => ({
  getPlace: jest.fn(),
  listPlaces: jest.fn(),
  savePlace: jest.fn(),
  searchPlaces: jest.fn(),
}));

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

function getAllTexts(
  root: ReactTestRenderer.ReactTestInstance,
): string[] {
  return root.findAllByType(Text).map(textNode => {
    return extractTextContent(textNode.props.children);
  });
}

afterEach(() => {
  placesApi.listPlaces.mockReset();
});

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
        provider: 'naver',
        providerPlaceId: 'naver_1',
        savedAt: '2026-03-16T10:00:00.000Z',
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
  expect(getAllTexts(instance.root)).toContain('Search places by keyword.');
  expect(getAllTexts(instance.root)).toContain('Provider results 0');
  expect(getAllTexts(instance.root).filter(text => text === 'Cafe Alpha')).toHaveLength(1);
});
