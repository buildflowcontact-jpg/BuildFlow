import { render } from '@testing-library/react';
jest.mock('../lib/comments', () => ({
  getTaskComments: jest.fn().mockResolvedValue([]),
  createComment: jest.fn().mockResolvedValue(null),
  addCommentReaction: jest.fn().mockResolvedValue(undefined),
  removeCommentReaction: jest.fn().mockResolvedValue(undefined),
}));
import { CommentSection } from '../components/CommentSection';

test('CommentSection se monte sans crash', () => {
  render(<CommentSection taskId="task-test" />);
});
