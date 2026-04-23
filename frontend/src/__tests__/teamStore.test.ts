import * as teamStore from '../utils/teamStore';

test('teamStore expose les fonctions attendues', () => {
  expect(typeof teamStore.getDisplayName).toBe('function');
  expect(typeof teamStore.getInitials).toBe('function');
  expect(typeof teamStore.getSubtitle).toBe('function');
  expect(typeof teamStore.pickColor).toBe('function');
  expect(typeof teamStore.generateId).toBe('function');
});
