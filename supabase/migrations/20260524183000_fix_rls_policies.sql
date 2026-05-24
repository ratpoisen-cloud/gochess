-- Fix RLS policies for games table
-- Dashboard auto-generated policies replaced our IS NULL checks

-- Drop Dashboard auto-generated policies (applied to public roles - wrong)
DROP POLICY IF EXISTS "games_select" ON games;
DROP POLICY IF EXISTS "games_insert" ON games;
DROP POLICY IF EXISTS "games_update" ON games;
DROP POLICY IF EXISTS "games_delete" ON games;

-- Recreate our custom policies with IS NULL checks (Dashboard stripped them)

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
