
import { supabase as supabaseMock } from '../__mocks__/supabase';
jest.mock('../lib/supabase', () => ({ supabase: supabaseMock }));
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import App from '../App';
import { AuthProvider } from '../context/AuthContext';

test('la vue de chargement respecte les regles a11y de base', async () => {
  const { container } = render(
    <AuthProvider>
      <App />
    </AuthProvider>
  );
  const results = await axe(container);
  expect(results).toHaveNoViolations(); // Extension déjà appliquée dans setupTests.ts
});
