
import { supabase as supabaseMock } from '../__mocks__/supabase';
jest.mock('../lib/supabase', () => ({ supabase: supabaseMock }));
import { render } from '@testing-library/react';
import { CreateProjectModal } from '../components/CreateProjectModal';

test('CreateProjectModal se monte sans crash', () => {
  render(<CreateProjectModal isOpen={true} onClose={() => {}} />);
});
