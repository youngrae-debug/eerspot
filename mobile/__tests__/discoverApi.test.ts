import { discoverPlacesFromLink } from '../src/features/discover/api/discoverApi';

test('discover link requests use an extended timeout budget', async () => {
  const authorizedRequest = jest.fn().mockResolvedValue({
    analysis: {
      detectedNameCount: 0,
      kind: 'single',
      matchedItemCount: 0,
      status: 'ready',
    },
    items: [],
    page: {
      contentPreview: '',
      description: null,
      locationHints: [],
      title: null,
      url: 'https://example.com',
    },
    queryHints: [],
  });

  await discoverPlacesFromLink(authorizedRequest, 'https://example.com');

  expect(authorizedRequest).toHaveBeenCalledWith('/places/discover-link', {
    method: 'POST',
    body: {
      url: 'https://example.com',
    },
    timeoutMs: 60000,
  });
});
