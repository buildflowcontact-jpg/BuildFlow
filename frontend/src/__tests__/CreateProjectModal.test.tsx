import { render } from '@testing-library/react';
jest.mock('../lib/supabase', () => require('../__mocks__/supabase'));
import { CreateProjectModal } from '../components/CreateProjectModal';

test('CreateProjectModal se monte sans crash', () => {
  render(<CreateProjectModal isOpen={true} onClose={() => {}} />);
});
