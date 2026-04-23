import { render, waitFor } from '@testing-library/react';
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
