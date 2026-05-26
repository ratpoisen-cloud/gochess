-- Atomic join function: prevents race condition when two users join the same game
-- Uses SELECT ... FOR UPDATE to lock the row during the check-and-update

CREATE OR REPLACE FUNCTION public.join_game_player_with_color(
  p_room_code TEXT,
  p_uid TEXT,
  p_name TEXT,
  p_preferred_color TEXT DEFAULT NULL
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game games%ROWTYPE;
  v_assigned_color TEXT;
BEGIN
  -- Lock the row to prevent concurrent joins
  SELECT * INTO v_game
  FROM games
  WHERE room_code = p_room_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Комната не найдена')::TEXT;
  END IF;

  -- Check if already a player (rejoin)
  IF v_game.white_player_id = p_uid THEN
    RETURN json_build_object('color', 'w', 'opponent_name', v_game.black_name)::TEXT;
  END IF;
  IF v_game.black_player_id = p_uid THEN
    RETURN json_build_object('color', 'b', 'opponent_name', v_game.white_name)::TEXT;
  END IF;

  -- Check if game is full
  IF v_game.white_player_id IS NOT NULL AND v_game.black_player_id IS NOT NULL THEN
    RETURN json_build_object('error', 'Комната уже заполнена')::TEXT;
  END IF;

  -- Assign color
  IF p_preferred_color = 'w' AND v_game.white_player_id IS NULL THEN
    v_assigned_color := 'w';
    UPDATE games SET
      white_player_id = p_uid,
      white_name = p_name
    WHERE id = v_game.id;
  ELSIF p_preferred_color = 'b' AND v_game.black_player_id IS NULL THEN
    v_assigned_color := 'b';
    UPDATE games SET
      black_player_id = p_uid,
      black_name = p_name
    WHERE id = v_game.id;
  ELSIF v_game.white_player_id IS NULL THEN
    v_assigned_color := 'w';
    UPDATE games SET
      white_player_id = p_uid,
      white_name = p_name
    WHERE id = v_game.id;
  ELSIF v_game.black_player_id IS NULL THEN
    v_assigned_color := 'b';
    UPDATE games SET
      black_player_id = p_uid,
      black_name = p_name
    WHERE id = v_game.id;
  ELSE
    RETURN json_build_object('error', 'Комната уже заполнена')::TEXT;
  END IF;

  RETURN json_build_object(
    'color', v_assigned_color,
    'opponent_name', CASE WHEN v_assigned_color = 'w' THEN v_game.black_name ELSE v_game.white_name END
  )::TEXT;
END;
$$;

-- Grant execute to authenticated users
REVOKE ALL ON FUNCTION public.join_game_player_with_color(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_game_player_with_color(TEXT, TEXT, TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
