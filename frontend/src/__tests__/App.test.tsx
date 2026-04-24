
import '@testing-library/jest-dom';
import { supabase as supabaseMock } from '../__mocks__/supabase';
jest.mock('../lib/supabase', () => ({ supabase: supabaseMock }));
import { render } from '@testing-library/react';
import App from '../App';
import { AuthProvider } from '../context/AuthContext';

test('affiche le fallback de chargement', () => {
  const { container } = render(
    <AuthProvider>
      <App />
    </AuthProvider>
  );
  expect(container.querySelector('.animate-spin')).toBeInTheDocument();
});
