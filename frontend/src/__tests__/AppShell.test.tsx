import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
jest.mock('../lib/supabase', () => require('../__mocks__/supabase'));
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
