import { render, screen, waitFor } from '@testing-library/react';
jest.mock('../lib/comments', () => ({
  getTaskComments: jest.fn().mockResolvedValue([]),
  getMentionablePlayers: jest.fn().mockResolvedValue([]),
  createComment: jest.fn().mockResolvedValue(null),
  addCommentReaction: jest.fn().mockResolvedValue(undefined),
  removeCommentReaction: jest.fn().mockResolvedValue(undefined),
}));
import { CommentSection } from '../components/CommentSection';
import { getTaskComments } from '../lib/comments';

test('CommentSection se monte sans crash', async () => {
  render(<CommentSection taskId="task-test" />);
  await waitFor(() => expect(getTaskComments).toHaveBeenCalledWith('task-test'));
  expect(screen.getByText("Aucun commentaire pour l'instant.")).toBeInTheDocument();
});
