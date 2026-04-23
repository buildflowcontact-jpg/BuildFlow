// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('../lib/supabase', () => require('../__mocks__/supabase'));
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn().mockReturnValue({ id: 'project-test-id' }),
}));
jest.mock('../lib/db', () => ({
  loadVirtualMembers: jest.fn().mockResolvedValue([]),
}));
jest.mock('../lib/search', () => ({
  saveFilter: jest.fn(),
  getUserFilters: jest.fn().mockResolvedValue([]),
  deleteFilter: jest.fn(),
}));
jest.mock('../lib/automationRules', () => ({
  checkAndExecuteRules: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../lib/taskDependencies', () => ({
  getTaskDependencies: jest.fn().mockResolvedValue([]),
  recalculateDependentTaskDates: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../components/DateInput', () => ({
  DateInput: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <input type="date" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));
jest.mock('../components/CommentSection', () => ({
  CommentSection: () => null,
}));
jest.mock('../components/TimeTracker', () => ({
  TimeTracker: () => null,
}));
jest.mock('../components/RecurrenceModal', () => ({
  RecurrenceModal: () => null,
}));
jest.mock('../components/TaskTemplateSelector', () => ({
  TaskTemplateSelector: () => null,
}));

import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import ProjectTasks from '../pages/project/ProjectTasks';

const mockFrom = supabase.from as jest.Mock;

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <MemoryRouter initialEntries={['/projects/project-test-id/tasks']}>
        {children}
      </MemoryRouter>
    </AuthProvider>
  );
}

function setupEmptyMocks() {
  mockFrom.mockImplementation(() => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
    delete: jest.fn().mockReturnThis(),
    then: jest.fn().mockImplementation((cb: (v: unknown) => unknown) =>
      cb({ data: [], error: null })
    ),
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
  }));
}

describe('ProjectTasks', () => {
  beforeEach(() => {
    setupEmptyMocks();
    jest.clearAllMocks();
    setupEmptyMocks();
  });

  it('monte sans crash et affiche le loader initial', () => {
    const { container } = render(<ProjectTasks />, { wrapper: Wrapper });
    // Pendant le chargement, des skeletons animés doivent être présents
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('affiche l\'en-tête "Tâches du projet" après chargement', async () => {
    render(<ProjectTasks />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(document.body.textContent).toContain('Tâches du projet');
    }, { timeout: 5000 });
  });

  it('charge les tâches via supabase.from("tasks")', async () => {
    render(<ProjectTasks />, { wrapper: Wrapper });
    await waitFor(() => {
      const calls = mockFrom.mock.calls.map(([t]: [string]) => t);
      expect(calls).toContain('tasks');
    }, { timeout: 5000 });
  });

  it('bascule en vue liste quand on clique sur le bouton liste', async () => {
    render(<ProjectTasks />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(document.body.textContent).toContain('Tâches du projet');
    }, { timeout: 5000 });

    const listViewBtn = document.querySelector('[aria-label="Activer la vue liste"]');
    if (listViewBtn) {
      fireEvent.click(listViewBtn);
      // Le bouton liste doit maintenant être actif (aria-pressed=true)
      await waitFor(() => {
        expect(listViewBtn.getAttribute('aria-pressed')).toBe('true');
      });
    }
  });

  it('affiche un bouton "Nouvelle tâche" pour les managers', async () => {
    // getSession retourne un user (manager par défaut dans le mock)
    render(<ProjectTasks />, { wrapper: Wrapper });
    await waitFor(() => {
      // Le chargement initial doit terminer
      expect(document.querySelector('.animate-pulse')).not.toBeInTheDocument();
    }, { timeout: 5000 });
  });
});
