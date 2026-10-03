import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  type Firestore,
  type Transaction,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
  buildRematchGameData,
  generateRoomCode,
  ROOM_CODE_LENGTH,
  timerFieldsFromControl,
  RAPID_PRESETS,
  type TimeControl,
} from '@/lib/gameDoc'
import type { Challenge, GameData, GameMode } from '@/types'

/**
 * A rematch offer stays open far longer than a lobby challenge: the player who
 * offered one may be waiting for a reply, and a finished game's result stays on
 * screen far longer than a 60 s invite popup.
 */
export const REMATCH_OFFER_TTL_MS = 10 * 60 * 1000

/** Lobby challenges keep the original short lifetime. */
export const CHALLENGE_TTL_MS = 60 * 1000

export function isRematchChallenge(c: Pick<Challenge, 'kind'>): boolean {
  return c.kind === 'rematch'
}

/**
 * Create the rematch game inside a transaction.
 *
 * `rematch_game_id` on the finished game is the single source of truth for
 * "this rematch already exists". Both entry points — the in-game accept button
 * and accepting the mirrored challenge — go through here, so pressing both, or
 * pressing twice, reuses the same game instead of creating a second one.
 */
export async function createRematchInTransaction(
  firestore: Firestore,
  transaction: Transaction,
  sourceGameId: string,
): Promise<{ gameId: string; created: boolean }> {
  const sourceRef = doc(firestore, 'games', sourceGameId)
  const sourceSnap = await transaction.get(sourceRef)
  const data = sourceSnap.data() as GameData | undefined
  if (!data) return { gameId: '', created: false }

  if (data.rematch_game_id) {
    return { gameId: data.rematch_game_id, created: false }
  }

  const newGameRef = doc(collection(firestore, 'games'))
  const payload = buildRematchGameData(data, generateRoomCode(ROOM_CODE_LENGTH))

  transaction.set(newGameRef, {
    ...payload,
    created_at: serverTimestamp(),
    last_move_time: serverTimestamp(),
  })
  transaction.update(sourceRef, {
    rematch_game_id: newGameRef.id,
    rematch_proposed_by: null,
  })

  return { gameId: newGameRef.id, created: true }
}

export interface AcceptResult {
  gameId: string
  created: boolean
  error?: 'no-db' | 'not-found' | 'already-answered'
}

/**
 * Accept a challenge of either kind.
 *
 * `challenge` — a fresh invitation from a lobby tile. The accepter plays black.
 * Rapid always gets a clock: if the invite carried none, the first preset is
 * used, because a rapid game without time_control silently plays untimed.
 *
 * `rematch` — replays the finished game it points at: same mode, same time
 * control, swapped sides (see buildRematchGameData). The challenge document is
 * marked accepted only once the game exists, so the sender's outgoing listener
 * can navigate to it.
 */
export async function acceptIncomingChallenge(
  challenge: Challenge,
  accepter: { uid: string; displayName?: string },
  firestore: Firestore | null = db,
): Promise<AcceptResult> {
  if (!firestore) return { gameId: '', created: false, error: 'no-db' }

  if (isRematchChallenge(challenge)) {
    if (!challenge.sourceGameId) {
      return { gameId: '', created: false, error: 'not-found' }
    }

    return runTransaction(firestore, async (transaction) => {
      const outcome = await createRematchInTransaction(
        firestore,
        transaction,
        challenge.sourceGameId as string,
      )
      if (!outcome.gameId) return { gameId: '', created: false, error: 'not-found' as const }

      const challengeRef = doc(firestore, 'challenges', challenge.id)
      const challengeSnap = await transaction.get(challengeRef)
      const status = (challengeSnap.data() as Challenge | undefined)?.status
      // Already accepted: keep the record, just report the existing game.
      if (status !== 'accepted') {
        transaction.update(challengeRef, {
          status: 'accepted',
          gameId: outcome.gameId,
        })
      }
      return { gameId: outcome.gameId, created: outcome.created }
    })
  }

  // --- plain challenge ---
  const mode: GameMode = challenge.mode ?? 'classic'
  const control: TimeControl | null =
    mode === 'rapid' ? (challenge.timeControl ?? RAPID_PRESETS[0]) : null

  let gameId = ''
  let created = false

  await runTransaction(firestore, async (transaction) => {
    const challengeRef = doc(firestore, 'challenges', challenge.id)
    const challengeSnap = await transaction.get(challengeRef)
    const data = challengeSnap.data() as Challenge | undefined
    if (!data) return

    // Lost the race, or answered in the other tab: reuse whatever exists.
    if (data.status !== 'pending') {
      gameId = data.gameId ?? ''
      return
    }

    const newGameRef = doc(collection(firestore, 'games'))
    transaction.set(newGameRef, {
      room_code: generateRoomCode(ROOM_CODE_LENGTH),
      // The challenger plays white; the accepter black.
      white_player_id: challenge.fromId,
      white_name: challenge.fromName || 'Игрок',
      black_player_id: accepter.uid,
      black_name: accepter.displayName || 'Игрок',
      game_type: 'online',
      game_mode: mode,
      pgn: '',
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      game_state: 'playing',
      winner: null,
      message: null,
      turn: 'w',
      ...timerFieldsFromControl(control),
      created_at: serverTimestamp(),
      last_move_time: Date.now(),
      reactions: [],
      undo_request: null,
      draw_request: null,
      rematch_proposed_by: null,
      rematch_game_id: null,
    })
    transaction.update(challengeRef, {
      status: 'accepted',
      gameId: newGameRef.id,
    })

    gameId = newGameRef.id
    created = true
  })

  if (!gameId) return { gameId: '', created: false, error: 'already-answered' }
  return { gameId, created }
}