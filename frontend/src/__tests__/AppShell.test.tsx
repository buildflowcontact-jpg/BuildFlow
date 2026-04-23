import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('../lib/supabase', () => require('../__mocks__/supabase'));
import AppShell from '../components/AppShell';
import { AuthProvider } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

test('AppShell se monte sans crash', async () => {
  render(
    <MemoryRouter>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </MemoryRouter>
  );
  await waitFor(() => expect(supabase.auth.getSession).toHaveBeenCalled());
});

test('le menu mobile ouvre et se ferme avec Escape', async () => {
  render(
    <MemoryRouter>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </MemoryRouter>
  );

  const openMenuButton = await screen.findByLabelText('Ouvrir le menu');
  fireEvent.click(openMenuButton);

  expect(document.body.style.overflow).toBe('hidden');

  fireEvent.keyDown(window, { key: 'Escape' });

  await waitFor(() => expect(document.body.style.overflow).toBe(''));
});
