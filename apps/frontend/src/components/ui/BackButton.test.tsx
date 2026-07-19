import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { BackButton } from './BackButton';

describe('BackButton', () => {
  it('navigates back to the previous page in history', async () => {
    render(
      <MemoryRouter initialEntries={['/from', '/to']} initialIndex={1}>
        <Routes>
          <Route path="/from" element={<p>From page</p>} />
          <Route path="/to" element={<BackButton />} />
        </Routes>
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(await screen.findByText('From page')).toBeInTheDocument();
  });
});
