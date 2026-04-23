import { render, waitFor } from '@testing-library/react';

jest.mock('../lib/supabase', () => require('../__mocks__/supabase'));
import App from '../App';
import { AuthProvider } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

test('affiche le fallback de chargement', async () => {
  const { container } = render(
    <AuthProvider>
      <App />
    </AuthProvider>
  );
  expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  await waitFor(() => expect(supabase.auth.getSession).toHaveBeenCalled());
});
