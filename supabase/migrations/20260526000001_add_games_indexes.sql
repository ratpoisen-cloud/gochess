-- Add missing indexes on games table to eliminate sequential scans

CREATE INDEX IF NOT EXISTS games_room_code_idx ON public.games (room_code);
CREATE INDEX IF NOT EXISTS games_white_player_id_idx ON public.games (white_player_id);
CREATE INDEX IF NOT EXISTS games_black_player_id_idx ON public.games (black_player_id);
CREATE INDEX IF NOT EXISTS games_created_at_idx ON public.games (created_at DESC);
CREATE INDEX IF NOT EXISTS games_game_state_idx ON public.games (game_state);

-- Composite index for LobbyPage query: WHERE white_player_id = X OR black_player_id = X ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS games_players_created_at_idx ON public.games (white_player_id, black_player_id, created_at DESC);

NOTIFY pgrst, 'reload schema';
