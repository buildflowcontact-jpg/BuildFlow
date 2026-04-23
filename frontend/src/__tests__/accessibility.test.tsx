import { render } from '@testing-library/react';
import { axe } from 'jest-axe';

jest.mock('../lib/supabase', () => require('../__mocks__/supabase'));
import App from '../App';
import { AuthProvider } from '../context/AuthContext';

test('la vue de chargement respecte les regles a11y de base', async () => {
  const { container } = render(
    <AuthProvider>
      <App />
    </AuthProvider>
  );
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
