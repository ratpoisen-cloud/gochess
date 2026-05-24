-- Add 'online' to game_type check constraint
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_game_type_check;
ALTER TABLE games ADD CONSTRAINT games_game_type_check
  CHECK (game_type IN ('bot', 'local', 'online'));

-- Add room_code for invite links
ALTER TABLE games ADD COLUMN IF NOT EXISTS room_code TEXT UNIQUE;

-- Add reactions column for emoji reactions on board
ALTER TABLE games ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '[]'::jsonb;

-- Enable Realtime on games table
ALTER PUBLICATION supabase_realtime ADD TABLE games;
