-- RLS policies for games table
-- Allow authenticated users to insert, select, and update games

-- Enable RLS (already enabled, but idempotent)
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- Policy: any authenticated user can create a game
DROP POLICY IF EXISTS "Users can create games" ON games;
CREATE POLICY "Users can create games"
  ON games FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: users can view games (own OR with empty slot for joining)
DROP POLICY IF EXISTS "Users can view own games" ON games;
CREATE POLICY "Users can view own games"
  ON games FOR SELECT
  TO authenticated
  USING (
    auth.uid() = white_player_id OR
    auth.uid() = black_player_id OR
    white_player_id IS NULL OR
    black_player_id IS NULL
  );

-- Policy: users can update own games OR join (fill empty slot)
DROP POLICY IF EXISTS "Users can update own games" ON games;
CREATE POLICY "Users can update own games"
  ON games FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = white_player_id OR
    auth.uid() = black_player_id OR
    white_player_id IS NULL OR
    black_player_id IS NULL
  )
  WITH CHECK (
    auth.uid() = white_player_id OR
    auth.uid() = black_player_id
  );

-- RLS policies for moves table
ALTER TABLE moves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert moves for own games" ON moves;
CREATE POLICY "Users can insert moves for own games"
  ON moves FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM games
      WHERE games.id = moves.game_id
      AND (games.white_player_id = auth.uid() OR games.black_player_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can view moves for own games" ON moves;
CREATE POLICY "Users can view moves for own games"
  ON moves FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM games
      WHERE games.id = moves.game_id
      AND (games.white_player_id = auth.uid() OR games.black_player_id = auth.uid())
    )
  );
