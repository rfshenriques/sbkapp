import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Breadcrumb, type BreadcrumbSegment } from './Breadcrumb';

function renderBreadcrumb(segments: BreadcrumbSegment[]) {
  return render(
    <MemoryRouter>
      <Breadcrumb segments={segments} />
    </MemoryRouter>,
  );
}

describe('Breadcrumb', () => {
  it('renders a plain link segment', () => {
    renderBreadcrumb([{ key: 'home', label: 'Home', href: '/' }]);

    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
  });

  it('renders a segment with no href or options as plain, non-interactive text', () => {
    renderBreadcrumb([{ key: 'match', label: 'Real Madrid vs Barcelona' }]);

    expect(screen.getByText('Real Madrid vs Barcelona')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('a single option does not turn the segment into a dropdown', () => {
    renderBreadcrumb([
      { key: 'competition', label: 'La Liga', href: '/x', options: [{ key: 'a', label: 'La Liga', href: '/x' }] },
    ]);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'La Liga' })).toBeInTheDocument();
  });

  it('opens a dropdown listing sibling options and navigating to the chosen one', async () => {
    renderBreadcrumb([
      {
        key: 'match',
        label: 'Real Madrid vs Barcelona',
        options: [
          { key: 'm1', label: 'Real Madrid vs Barcelona', href: '/matches/1' },
          { key: 'm2', label: 'Atletico vs Sevilla', href: '/matches/2' },
        ],
      },
    ]);

    await userEvent.click(screen.getByRole('button', { name: 'Real Madrid vs Barcelona' }));

    expect(screen.getByRole('option', { name: 'Atletico vs Sevilla' })).toHaveAttribute(
      'href',
      '/matches/2',
    );
  });

  it('closes the dropdown on Escape', async () => {
    renderBreadcrumb([
      {
        key: 'country',
        label: 'Spain',
        options: [
          { key: 'c1', label: 'Spain', href: '/sports/football?country=Spain' },
          { key: 'c2', label: 'England', href: '/sports/football?country=England' },
        ],
      },
    ]);

    await userEvent.click(screen.getByRole('button', { name: 'Spain' }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
