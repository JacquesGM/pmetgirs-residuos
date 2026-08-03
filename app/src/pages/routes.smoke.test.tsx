import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { routes } from '../routes';

describe('every route renders without throwing', () => {
  for (const route of routes) {
    it(
      `${route.path} (${route.title})`,
      async () => {
        render(<MemoryRouter initialEntries={[route.path]}>{route.element}</MemoryRouter>);
        const headings = await screen.findAllByRole('heading', {}, { timeout: 8000 });
        expect(headings.length).toBeGreaterThan(0);
      },
      10000,
    );
  }
});
