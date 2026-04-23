import { render } from '@testing-library/react';

jest.mock('../lib/supabase', () => require('../__mocks__/supabase'));
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
