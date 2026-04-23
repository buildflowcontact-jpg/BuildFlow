import { render, screen } from '@testing-library/react';
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('../lib/supabase', () => require('../__mocks__/supabase'));
import { CreateProjectModal } from '../components/CreateProjectModal';

test('CreateProjectModal se monte sans crash', async () => {
  render(<CreateProjectModal isOpen={true} onClose={() => {}} />);
  expect(await screen.findByText("Aucun pattern personnel pour l'instant.")).toBeInTheDocument();
});
