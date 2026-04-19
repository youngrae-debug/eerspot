import { extractDiscoverUrlFromAppLink } from '../src/features/discover/linking';

test('extracts a discover target url from the custom app link', () => {
  expect(
    extractDiscoverUrlFromAppLink(
      'eerspot://discover?url=https%3A%2F%2Fwww.instagram.com%2Fp%2FDWBK956jR0X%2F%3Fimg_index%3D1',
    ),
  ).toBe('https://www.instagram.com/p/DWBK956jR0X/?img_index=1');
});

test('ignores unrelated app links', () => {
  expect(
    extractDiscoverUrlFromAppLink('eerspot://calendar?date=2026-04-12'),
  ).toBeNull();
  expect(
    extractDiscoverUrlFromAppLink('https://www.instagram.com/p/DWBK956jR0X/'),
  ).toBeNull();
});
