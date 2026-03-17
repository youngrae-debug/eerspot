/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

test('renders the eerspot app shell', async () => {
  let instance!: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    instance = ReactTestRenderer.create(<App />);
  });

  expect(instance).toBeTruthy();
});
