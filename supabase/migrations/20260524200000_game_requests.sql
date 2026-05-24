-- Add request columns to games table (Undo, Draw, Rematch)
-- Triggering migration sync via GitHub push
ALTER TABLE games ADD COLUMN IF NOT EXISTS undo_request JSONB DEFAULT NULL;
ALTER TABLE games ADD COLUMN IF NOT EXISTS draw_request JSONB DEFAULT NULL;
ALTER TABLE games ADD COLUMN IF NOT EXISTS rematch_request JSONB DEFAULT NULL;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
