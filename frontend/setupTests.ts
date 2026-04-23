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
		originalError(...args);
	});
});

afterAll(() => {
	(console.error as jest.Mock).mockRestore();
});
