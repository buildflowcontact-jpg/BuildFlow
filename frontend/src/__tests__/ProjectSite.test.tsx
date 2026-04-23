// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('../lib/supabase', () => require('../__mocks__/supabase'));
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn().mockReturnValue({ id: 'project-test-id' }),
  useSearchParams: jest.fn().mockReturnValue([new URLSearchParams(), jest.fn()]),
}));
jest.mock('../lib/constructionSite', () => ({
  loadConstructionPhaseMetrics: jest.fn().mockResolvedValue([]),
  loadConstructionSiteData: jest.fn().mockResolvedValue({
    phases: [], qualifications: [], safetyItems: [], supplies: [],
    equipmentBookings: [], journalEntries: [], subcontractors: [], incidents: [],
  }),
  createConstructionPhase: jest.fn().mockResolvedValue(null),
  updateConstructionPhase: jest.fn().mockResolvedValue(null),
  deleteConstructionPhase: jest.fn().mockResolvedValue(null),
  createWorkerQualification: jest.fn().mockResolvedValue(null),
  deleteWorkerQualification: jest.fn().mockResolvedValue(null),
  createSafetyChecklistItem: jest.fn().mockResolvedValue(null),
  toggleSafetyChecklistItem: jest.fn().mockResolvedValue(null),
  deleteSafetyChecklistItem: jest.fn().mockResolvedValue(null),
  createSupplyOrder: jest.fn().mockResolvedValue(null),
  updateSupplyOrderStatus: jest.fn().mockResolvedValue(null),
  deleteSupplyOrder: jest.fn().mockResolvedValue(null),
  createEquipmentBooking: jest.fn().mockResolvedValue(null),
  deleteEquipmentBooking: jest.fn().mockResolvedValue(null),
  createSiteJournalEntry: jest.fn().mockResolvedValue(null),
  deleteSiteJournalEntry: jest.fn().mockResolvedValue(null),
  createProjectSubcontractor: jest.fn().mockResolvedValue(null),
  deleteProjectSubcontractor: jest.fn().mockResolvedValue(null),
}));
jest.mock('../lib/siteNotifications', () => ({
  syncSiteAlertsNotifications: jest.fn().mockResolvedValue([]),
}));

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import ProjectSite from '../pages/project/ProjectSite';

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <MemoryRouter initialEntries={['/projects/project-test-id/site']}>
        {children}
      </MemoryRouter>
    </AuthProvider>
  );
}

describe('ProjectSite', () => {
  it('monte sans crash et affiche le loader', () => {
    const { container } = render(<ProjectSite />, { wrapper: Wrapper });
    // Spinner ou contenu chargé: l'un des deux est attendu
    expect(container.firstChild).toBeTruthy();
  });

  it('affiche les sections du chantier après chargement', async () => {
    render(<ProjectSite />, { wrapper: Wrapper });
    await waitFor(() => {
      // Les sections principales doivent être présentes dans le DOM
      const headings = document.querySelectorAll('h2, h3, [role="heading"]');
      expect(headings.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  it('appelle loadConstructionSiteData avec le projectId', async () => {
    const { loadConstructionSiteData } = require('../lib/constructionSite');
    render(<ProjectSite />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(loadConstructionSiteData).toHaveBeenCalledWith('project-test-id');
    }, { timeout: 3000 });
  });

  it('appelle loadConstructionPhaseMetrics avec le projectId', async () => {
    const { loadConstructionPhaseMetrics } = require('../lib/constructionSite');
    render(<ProjectSite />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(loadConstructionPhaseMetrics).toHaveBeenCalledWith('project-test-id');
    }, { timeout: 3000 });
  });
});
