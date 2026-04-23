import { render, screen } from '@testing-library/react';
jest.mock('../lib/supabase', () => require('../__mocks__/supabase'));
import { CreateProjectModal } from '../components/CreateProjectModal';

test('CreateProjectModal se monte sans crash', async () => {
  render(<CreateProjectModal isOpen={true} onClose={() => {}} />);
  expect(await screen.findByText("Aucun pattern personnel pour l'instant.")).toBeInTheDocument();
});
