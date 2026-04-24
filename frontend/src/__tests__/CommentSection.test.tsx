import { render } from '@testing-library/react';
import { CommentSection } from '../components/CommentSection';


import * as commentsLib from '../lib/comments';
jest.mock('../lib/comments');
beforeAll(() => {
  (commentsLib.getTaskComments as jest.Mock).mockResolvedValue([]);
  (commentsLib.createComment as jest.Mock).mockResolvedValue(null);
  (commentsLib.addCommentReaction as jest.Mock).mockResolvedValue(undefined);
  (commentsLib.removeCommentReaction as jest.Mock).mockResolvedValue(undefined);
});

test('CommentSection se monte sans crash', () => {
  render(<CommentSection taskId="1" />);
});
