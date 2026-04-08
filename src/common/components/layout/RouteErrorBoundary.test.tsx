import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RouteErrorBoundary } from '@/common/components/layout/RouteErrorBoundary';

const ThrowingComponent = (): ReactElement => {
  throw new Error('Boom');
};

describe('RouteErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a recovery card when a route throws during render', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <MemoryRouter initialEntries={['/scenarios']}>
        <RouteErrorBoundary>
          <ThrowingComponent />
        </RouteErrorBoundary>
      </MemoryRouter>,
    );

    expect(screen.getByText('Something went wrong on this page.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to scenarios' })).toHaveAttribute('href', '/scenarios');
  });
});
