// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('../lib/supabase', () => require('../__mocks__/supabase'));
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn().mockReturnValue({ id: 'project-test-id' }),
}));
jest.mock('../components/FileUpload', () => ({
  FileUpload: () => null,
}));
jest.mock('../components/DateInput', () => ({
  DateInput: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <input type="date" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import ProjectBudget from '../pages/project/ProjectBudget';

const mockFrom = supabase.from as jest.Mock;

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <MemoryRouter initialEntries={['/projects/project-test-id/budget']}>
        {children}
      </MemoryRouter>
    </AuthProvider>
  );
}

function setupEmptyMocks() {
  mockFrom.mockImplementation(() => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    then: jest.fn().mockImplementation((cb: (v: unknown) => unknown) =>
      cb({ data: [], error: null })
    ),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
  }));
  // maybeSingle doit être chainable APRES eq()
  // On utilise un objet avec toutes les méthodes nécessaires
  const chain: Record<string, jest.Mock> = {} as Record<string, jest.Mock>;
  chain.select = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.order = jest.fn().mockReturnValue(chain);
  chain.update = jest.fn().mockReturnValue(chain);
  chain.insert = jest.fn().mockReturnValue(chain);
  chain.delete = jest.fn().mockReturnValue(chain);
  chain.upsert = jest.fn().mockResolvedValue({ data: null, error: null });
  chain.single = jest.fn().mockResolvedValue({ data: null, error: null });
  chain.maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
  chain.then = jest.fn().mockImplementation((cb: (v: unknown) => unknown) =>
    cb({ data: [], error: null })
  );
  mockFrom.mockReturnValue(chain);
}

describe('ProjectBudget', () => {
  beforeEach(() => {
    setupEmptyMocks();
  });

  it('monte sans crash', () => {
    const { container } = render(<ProjectBudget />, { wrapper: Wrapper });
    expect(container.firstChild).toBeTruthy();
  });

  it('affiche un indicateur de chargement ou le contenu', async () => {
    render(<ProjectBudget />, { wrapper: Wrapper });
    // L'écran doit afficher quelque chose (spinner ou contenu)
    await waitFor(() => {
      expect(document.body.textContent).not.toBe('');
    });
  });

  it('appelle supabase.from("expenses") pour charger les dépenses', async () => {
    render(<ProjectBudget />, { wrapper: Wrapper });
    await waitFor(() => {
      const calls = (mockFrom as jest.Mock).mock.calls.map(([table]: [string]) => table);
      expect(calls).toContain('expenses');
    }, { timeout: 3000 });
  });

  it('appelle supabase.from("construction_phases") pour les phases', async () => {
    render(<ProjectBudget />, { wrapper: Wrapper });
    await waitFor(() => {
      const calls = (mockFrom as jest.Mock).mock.calls.map(([table]: [string]) => table);
      expect(calls).toContain('construction_phases');
    }, { timeout: 3000 });
  });
});
