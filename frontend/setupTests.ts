// Mock global Supabase pour tous les tests (fallback)
jest.mock('./src/lib/supabase', () => require('./src/__mocks__/supabase'));
import '@testing-library/jest-dom';
import { toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

const originalWarn = console.warn;
const originalError = console.error;

beforeAll(() => {
	jest.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
		const [firstArg] = args;
		if (typeof firstArg === 'string' && firstArg.includes('React Router Future Flag Warning')) {
			return;
		}
		originalWarn(...args);
	});
});

afterAll(() => {
	(console.warn as jest.Mock).mockRestore();
});

beforeAll(() => {
	jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
		const [firstArg] = args;
		if (typeof firstArg === 'string' && firstArg.includes('not wrapped in act(...)')) {
			return;
		}
		if (typeof firstArg === 'string' && firstArg.includes('A suspended resource finished loading inside a test')) {
			return;
		}
		if (typeof firstArg === 'string' && (
			firstArg.startsWith('persistTask:') ||
			firstArg.startsWith('loadTasks:') ||
			firstArg.startsWith('loadProjectTeamMembers members:') ||
			firstArg.startsWith('createProjectVirtualMember:')
		)) {
			return;
		}
		originalError(...args);
	});
});

afterAll(() => {
	(console.error as jest.Mock).mockRestore();
});
