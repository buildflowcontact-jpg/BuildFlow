
import { supabase as supabaseMock } from '../__mocks__/supabase';
jest.mock('../lib/supabase', () => ({ supabase: supabaseMock }));
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { AuthProvider } from '../context/AuthContext';

test('AppShell se monte sans crash', () => {
  render(
    <MemoryRouter>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </MemoryRouter>
  );
});
