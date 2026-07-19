import type { ReactNode } from 'react';
import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Breadcrumb, type BreadcrumbSegment } from './Breadcrumb';

function renderBreadcrumb(segments: BreadcrumbSegment[], icon?: ReactNode) {
  return render(
    <MemoryRouter>
      <Breadcrumb segments={segments} icon={icon} />
    </MemoryRouter>,
  );
}

/**
 * jsdom doesn't evaluate CSS breakpoints, so the mobile and desktop layouts
 * both exist in the DOM at once (only one is actually visible in a real
 * browser). Scope queries to one layout at a time via its data-testid to
 * avoid ambiguous matches between them.
 */
function desktop() {
  return within(screen.getByTestId('breadcrumb-desktop'));
}
function mobile() {
  return within(screen.getByTestId('breadcrumb-mobile'));
}

describe('Breadcrumb (desktop layout)', () => {
  it('renders a plain link segment', () => {
    renderBreadcrumb([{ key: 'home', label: 'Home', href: '/' }]);

    expect(desktop().getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
  });

  it('renders a segment with no href or options as plain, non-interactive text', () => {
    renderBreadcrumb([{ key: 'match', label: 'Real Madrid vs Barcelona' }]);

    expect(desktop().getByText('Real Madrid vs Barcelona')).toBeInTheDocument();
    expect(desktop().queryByRole('button')).not.toBeInTheDocument();
  });

  it('a single option does not turn the segment into a dropdown', () => {
    renderBreadcrumb([
      { key: 'competition', label: 'La Liga', href: '/x', options: [{ key: 'a', label: 'La Liga', href: '/x' }] },
    ]);

    expect(desktop().queryByRole('button')).not.toBeInTheDocument();
    expect(desktop().getByRole('link', { name: 'La Liga' })).toBeInTheDocument();
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

    await userEvent.click(desktop().getByRole('button', { name: 'Real Madrid vs Barcelona' }));

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

    await userEvent.click(desktop().getByRole('button', { name: 'Spain' }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});

describe('Breadcrumb (mobile layout)', () => {
  const segments: BreadcrumbSegment[] = [
    { key: 'home', label: 'Home', href: '/' },
    { key: 'sport', label: 'Football', href: '/sports/Football' },
    {
      key: 'competition',
      label: 'UEFA Champions League Qualification',
      href: '/sports/Football?competition=UEFA%20Champions%20League%20Qualification',
    },
    {
      key: 'match',
      label: 'Mjallby AIF vs Lincoln Red Imps FC',
      options: [
        { key: 'm1', label: 'Mjallby AIF vs Lincoln Red Imps FC', href: '/matches/1' },
        { key: 'm2', label: 'Another Match', href: '/matches/2' },
      ],
    },
  ];

  it('puts every ancestor except Home and the last segment on a plain, non-dropdown trail line', () => {
    renderBreadcrumb(segments);

    const trail = within(screen.getByRole('navigation', { name: 'Breadcrumb trail' }));
    // Home is dropped on mobile - the back button and icon already say "you can leave this page".
    expect(trail.queryByRole('link', { name: 'Home' })).not.toBeInTheDocument();
    expect(trail.getByRole('link', { name: 'Football' })).toBeInTheDocument();
    expect(trail.getByText('UEFA Champions League Qualification')).toBeInTheDocument();
    // The last segment (Match) belongs to the pill below, not the trail.
    expect(trail.queryByText('Mjallby AIF vs Lincoln Red Imps FC')).not.toBeInTheDocument();
  });

  it('renders only the final segment as a dropdown pill', async () => {
    renderBreadcrumb(segments);

    const pillButton = mobile().getByRole('button', { name: 'Mjallby AIF vs Lincoln Red Imps FC' });
    await userEvent.click(pillButton);

    expect(screen.getByRole('option', { name: 'Another Match' })).toHaveAttribute('href', '/matches/2');
  });

  it('renders the final segment as a plain pill (not a dropdown) when it has no siblings', () => {
    renderBreadcrumb([
      { key: 'home', label: 'Home', href: '/' },
      { key: 'sport', label: 'Football', href: '/sports/Football' },
      { key: 'match', label: 'Solo Match' },
    ]);

    expect(mobile().getByText('Solo Match')).toBeInTheDocument();
    expect(mobile().queryByRole('button')).not.toBeInTheDocument();
  });

  it('puts a passed icon on the trail line, before the rest of the trail', () => {
    renderBreadcrumb(segments, <span data-testid="my-icon">icon</span>);

    const trail = within(screen.getByRole('navigation', { name: 'Breadcrumb trail' }));
    expect(trail.getByTestId('my-icon')).toBeInTheDocument();
  });

  it('never truncates the pill label or its dropdown options - full team/match names always show', async () => {
    renderBreadcrumb(segments);

    const pillButton = mobile().getByRole('button', { name: 'Mjallby AIF vs Lincoln Red Imps FC' });
    expect(pillButton.querySelector('.truncate')).toBeNull();

    await userEvent.click(pillButton);
    const option = screen.getByRole('option', { name: 'Another Match' });
    expect(option.className).not.toContain('truncate');
  });
});
