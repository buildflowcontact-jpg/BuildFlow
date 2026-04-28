
import React from 'react';
jest.mock('../lib/supabase', () => {
  const { supabase } = require('../__mocks__/supabase');
  return { supabase };
});
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
