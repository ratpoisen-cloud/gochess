-- Create moves table for full move history
CREATE TABLE IF NOT EXISTS public.moves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  move_number INTEGER NOT NULL,
  from_square TEXT NOT NULL,
  to_square TEXT NOT NULL,
  piece TEXT NOT NULL,
  captured TEXT,
  promotion TEXT,
  san TEXT NOT NULL,
  is_check BOOLEAN DEFAULT FALSE,
  is_checkmate BOOLEAN DEFAULT FALSE,
  fen_after TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for moves
CREATE INDEX IF NOT EXISTS moves_game_id_idx ON public.moves (game_id);
CREATE INDEX IF NOT EXISTS moves_game_id_move_number_idx ON public.moves (game_id, move_number);

-- Enable RLS
ALTER TABLE public.moves ENABLE ROW LEVEL SECURITY;

-- RLS: players can insert moves for their own games
DROP POLICY IF EXISTS "Users can insert moves for own games" ON public.moves;
CREATE POLICY "Users can insert moves for own games"
  ON public.moves FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.games
      WHERE games.id = moves.game_id
      AND (games.white_player_id = auth.uid() OR games.black_player_id = auth.uid())
    )
  );

-- RLS: players can view moves for their own games
DROP POLICY IF EXISTS "Users can view moves for own games" ON public.moves;
CREATE POLICY "Users can view moves for own games"
  ON public.moves FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.games
      WHERE games.id = moves.game_id
      AND (games.white_player_id = auth.uid() OR games.black_player_id = auth.uid())
    )
  );

-- Enable Realtime on moves
ALTER PUBLICATION supabase_realtime ADD TABLE public.moves;

NOTIFY pgrst, 'reload schema';
