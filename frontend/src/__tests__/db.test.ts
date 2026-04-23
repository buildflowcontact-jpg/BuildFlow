// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('../lib/supabase', () => require('../__mocks__/supabase'));

import { supabase } from '../lib/supabase';
import {
  persistTask,
  removeTask,
  loadTasks,
  loadProjectTeamMembers,
  createProjectVirtualMember,
  upsertUserProfile,
} from '../lib/db';
import type { LocalTask } from '../utils/teamStore';

const mockFrom = supabase.from as jest.Mock;

function resetChain(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, unknown> = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    then: jest.fn().mockImplementation((cb: (v: unknown) => unknown) => cb({ data: [], error: null })),
    ...overrides,
  };
  mockFrom.mockReturnValue(chain);
  return chain;
}

// ─── persistTask ──────────────────────────────────────────────────────────────

describe('persistTask', () => {
  const task: LocalTask = {
    id: 'task-1',
    title: 'Test task',
    description: 'desc',
    status: 'todo',
    priority: 'medium',
    assigneeIds: ['user-1'],
    subtasks: [],
    startDate: '2026-01-01',
    dueDate: '2026-01-31',
  };

  it('appelle upsert sur tasks avec les bons champs', async () => {
    const chain = resetChain({
      upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
    });

    await persistTask(task, 'user-1');

    expect(mockFrom).toHaveBeenCalledWith('tasks');
    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'task-1',
        title: 'Test task',
        status: 'todo',
        priority: 'medium',
        created_by: 'user-1',
      })
    );
  });

  it('ne plante pas si upsert retourne une erreur', async () => {
    resetChain({
      upsert: jest.fn().mockResolvedValue({ data: null, error: { message: 'upsert error' } }),
    });

    await expect(persistTask(task, 'user-1')).resolves.toBeUndefined();
  });

  it('synchronise les sous-tâches quand elles existent', async () => {
    const taskWithSubs: LocalTask = {
      ...task,
      subtasks: [{ id: 'sub-1', title: 'Sub', status: 'todo', assigneeIds: [] }],
    };

    const calls: string[] = [];
    mockFrom.mockImplementation((table: string) => {
      calls.push(table);
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
        delete: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((cb: (v: unknown) => unknown) => cb({ data: [], error: null })),
      };
    });

    await persistTask(taskWithSubs, 'user-1');

    expect(calls).toContain('tasks');
    expect(calls).toContain('subtasks');
  });
});

// ─── removeTask ───────────────────────────────────────────────────────────────

describe('removeTask', () => {
  it('appelle delete sur tasks avec le bon id', async () => {
    const chain = resetChain({
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ data: null, error: null }),
    });

    await removeTask('task-42');

    expect(mockFrom).toHaveBeenCalledWith('tasks');
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('id', 'task-42');
  });
});

// ─── loadTasks ────────────────────────────────────────────────────────────────

describe('loadTasks', () => {
  it('retourne [] si la requête échoue', async () => {
    const chain: Record<string, jest.Mock> = {
      select: jest.fn().mockImplementation(() => chain),
      or: jest.fn().mockImplementation(() => chain),
      is: jest.fn().mockImplementation(() => chain),
      in: jest.fn().mockImplementation(() => chain),
      order: jest.fn().mockImplementation(() => chain),
      limit: jest.fn().mockImplementation(() => chain),
      then: jest.fn().mockImplementation((cb: (v: unknown) => unknown) =>
        cb({ data: null, error: { message: 'db error' } })
      ),
    };
    mockFrom.mockReturnValue(chain);

    const result = await loadTasks('user-1');
    expect(result).toEqual([]);
  });

  it('retourne les tâches mappées depuis les rows Supabase', async () => {
    const rows = [
      {
        id: 'task-1',
        title: 'Ma tâche',
        description: 'desc',
        status: 'in-progress',
        priority: 'high',
        assignee_ids: ['user-1'],
        start_date: '2026-01-01',
        end_date: '2026-01-31',
        due_date: null,
        parent_id: null,
        subtasks: [],
      },
    ];

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      const chain: Record<string, jest.Mock> = {
        select: jest.fn().mockImplementation(() => chain),
        or: jest.fn().mockImplementation(() => chain),
        is: jest.fn().mockImplementation(() => chain),
        in: jest.fn().mockImplementation(() => chain),
        order: jest.fn().mockImplementation(() => chain),
        limit: jest.fn().mockImplementation(() => chain),
        then: jest.fn().mockImplementation((cb: (v: unknown) => unknown) => {
          callCount++;
          // first call = tasks, second = dependencies
          if (callCount === 1) return cb({ data: rows, error: null });
          return cb({ data: [], error: null });
        }),
      };
      return chain;
    });

    const result = await loadTasks('user-1');
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Ma tâche');
    expect(result[0].status).toBe('in-progress');
  });
});

// ─── loadProjectTeamMembers ───────────────────────────────────────────────────

describe('loadProjectTeamMembers', () => {
  it('retourne les membres app et virtuels combinés', async () => {
    const memberRows = [{ user_id: 'user-1' }, { user_id: 'user-2' }];
    const profileRows = [
      { id: 'user-1', name: 'Alice', email: 'alice@test.com', color: 'bg-violet-500' },
      { id: 'user-2', name: 'Bob', email: 'bob@test.com', color: 'bg-sky-500' },
    ];

    let callIndex = 0;
    mockFrom.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      then: jest.fn().mockImplementation((cb: (v: unknown) => unknown) => {
        callIndex++;
        if (callIndex === 1) return cb({ data: memberRows, error: null });  // project_members
        if (callIndex === 2) return cb({ data: profileRows, error: null }); // user_profiles
        return cb({ data: [], error: null }); // virtual_members
      }),
    }));

    const result = await loadProjectTeamMembers('project-1');
    const appMembers = result.filter((m) => m.type === 'app');
    expect(appMembers).toHaveLength(2);
    expect(appMembers[0].id).toBe('user-1');
  });

  it('retourne [] si la requête project_members échoue', async () => {
    let callIndex = 0;
    mockFrom.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      then: jest.fn().mockImplementation((cb: (v: unknown) => unknown) => {
        callIndex++;
        if (callIndex === 1) return cb({ data: null, error: { message: 'error' } });
        return cb({ data: [], error: null });
      }),
    }));

    const result = await loadProjectTeamMembers('project-1');
    // Avec une erreur sur members, la liste app sera vide, seuls les virtuels restent
    const appMembers = result.filter((m) => m.type === 'app');
    expect(appMembers).toHaveLength(0);
  });
});

// ─── createProjectVirtualMember ──────────────────────────────────────────────

describe('createProjectVirtualMember', () => {
  const baseInput = {
    firstName: 'Jean',
    lastName: 'Dupont',
    position: 'Chef',
    company: 'Noveo',
    email: 'jean@noveo.com',
  };

  it('retourne mode app si un profil utilisateur correspond à l\'email', async () => {
    let callIndex = 0;
    mockFrom.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
      order: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockImplementation(() => {
        callIndex++;
        if (callIndex === 1) {
          // findUserProfileByEmail → retourne un profil correspondant
          return Promise.resolve({ data: { id: 'existing-user-id', name: 'Jean', email: 'jean@noveo.com', color: null }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      }),
      then: jest.fn().mockImplementation((cb: (v: unknown) => unknown) => cb({ data: null, error: null })),
    }));

    const result = await createProjectVirtualMember('project-1', baseInput, 'creator-id');
    expect(result?.mode).toBe('app');
    expect(result?.userId).toBe('existing-user-id');
  });

  it('retourne mode virtual si aucun profil ne correspond', async () => {
    mockFrom.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      single: jest.fn().mockResolvedValue({
        data: { id: 'new-virtual-id', first_name: 'Jean', last_name: 'Dupont', position: 'Chef', company: 'Noveo', email: 'jean@noveo.com', color: 'bg-violet-500', project_id: 'project-1', linked_user_id: null, is_favorite: false, source_favorite_id: null },
        error: null,
      }),
      then: jest.fn().mockImplementation((cb: (v: unknown) => unknown) => cb({ data: null, error: null })),
    }));

    const result = await createProjectVirtualMember('project-1', baseInput, 'creator-id');
    expect(result?.mode).toBe('virtual');
    expect(result?.memberId).toBe('new-virtual-id');
  });

  it('retourne null si l\'insert échoue', async () => {
    mockFrom.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      single: jest.fn().mockResolvedValue({ data: null, error: { message: 'insert error' } }),
      then: jest.fn().mockImplementation((cb: (v: unknown) => unknown) => cb({ data: null, error: null })),
    }));

    const result = await createProjectVirtualMember('project-1', baseInput, 'creator-id');
    expect(result).toBeNull();
  });
});

// ─── upsertUserProfile ────────────────────────────────────────────────────────

describe('upsertUserProfile', () => {
  it('appelle upsert sur user_profiles avec les bons champs', async () => {
    const chain = resetChain({
      upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
    });

    await upsertUserProfile('user-1', 'alice@test.com', 'Alice');

    expect(mockFrom).toHaveBeenCalledWith('user_profiles');
    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1', email: 'alice@test.com', name: 'Alice' }),
      expect.objectContaining({ onConflict: 'id' })
    );
  });
});
