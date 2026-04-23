import { render, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';

// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('../lib/supabase', () => require('../__mocks__/supabase'));
import App from '../App';
import { AuthProvider } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

test('la vue de chargement respecte les regles a11y de base', async () => {
  const { container } = render(
    <AuthProvider>
      <App />
    </AuthProvider>
  );
  await waitFor(() => expect(supabase.auth.getSession).toHaveBeenCalled());
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
