-- Batch 2: Final cleanup for remaining unindexed_foreign_keys
-- Targeted residual FK constraints still reported after batch 1

CREATE INDEX IF NOT EXISTS comment_reactions_user_id_fk_idx ON public.comment_reactions(user_id);
CREATE INDEX IF NOT EXISTS project_members_user_id_fk_idx ON public.project_members(user_id);
CREATE INDEX IF NOT EXISTS team_capacity_user_id_fk_idx ON public.team_capacity(user_id);
