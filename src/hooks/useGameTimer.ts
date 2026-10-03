import { useState, useCallback, useEffect, useRef } from 'react'
import { doc, runTransaction } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { GameData } from '@/types'

type TimeoutFlagParams = {
  gameDocId: string
  /** Side whose clock is running (the side to move). */
  turn: 'w' | 'b'
  myColor: 'w' | 'b'
  lastTimerUpdate: number
  turnTimeLeft: number
}

/**
 * Write the timeout result, guarded so concurrent clients and stale reads
 * cannot clobber a game that has just changed or ended.
 *
 * - `turn === myColor` never writes: the player whose flag fell must not
 *   flag themselves off a skewed local clock (their opponent's client does
 *   it; a move attempt by the loser also does it in useGameSync).
 * - `elapsed` is clamped at 0: a device with a fast clock must not gift
 *   itself extra seconds by writing `last_timer_update` in the future.
 * - single in-flight write per client (flaggingRef) so a 1 s interval
 *   cannot spam transactions while the first one is still running.
 */
function submitTimeoutFlag(
  flaggingRef: { current: boolean },
  params: TimeoutFlagParams & { allowSelf?: boolean },
): void {
  if (!db || flaggingRef.current) return
  const { gameDocId, turn, myColor, lastTimerUpdate, turnTimeLeft, allowSelf } = params
  // The interval never flags the player themselves (a fast local clock
  // would auto-loss them mid-game); the explicit zero-clock callback may.
  if (turn === myColor && !allowSelf) return

  const elapsed = Math.max(0, Date.now() - lastTimerUpdate)
  if (turnTimeLeft - elapsed > -1000) return

  flaggingRef.current = true
  try {
    Promise.resolve(
      runTransaction(db, async (transaction) => {
        const ref = doc(db, 'games', gameDocId)
        const snap = await transaction.get(ref)
        const data = snap.data()
        if (!data) return
        if (data.game_state === 'game_over') return
        // The document moved on since we computed the timeout — re-evaluate
        // from the fresh snapshot instead of flagging a stale position.
        if (data.turn !== turn || data.last_timer_update !== lastTimerUpdate) return
        transaction.update(ref, {
          game_state: 'game_over',
          winner: myColor === 'w' ? 'white' : 'black',
          message: 'timeout',
        })
      })
    )
      .catch(() => { /* snapshot will deliver the final state */ })
      .finally(() => {
        flaggingRef.current = false
      })
  } catch {
    flaggingRef.current = false
  }
}

export function useGameTimer(gameDocId: string | null) {
  const [whiteTimeLeft, setWhiteTimeLeft] = useState<number | null>(null)
  const [blackTimeLeft, setBlackTimeLeft] = useState<number | null>(null)
  const [lastTimerUpdate, setLastTimerUpdate] = useState<number | null>(null)
  const [timerStatus, setTimerStatus] = useState<'active' | 'paused' | null>(null)
  const [timeControl, setTimeControl] = useState<GameData['time_control']>(null)

  // Latest document facts for the interval; state alone cannot describe
  // "whose clock is running" and "is the game already over".
  const myColorRef = useRef<'w' | 'b' | null>(null)
  const turnRef = useRef<'w' | 'b' | null>(null)
  const gameOverRef = useRef(false)
  const flaggingRef = useRef(false)

  const setTimerFromSnapshot = useCallback((newData: GameData, myColor: 'w' | 'b' | null) => {
    if (!newData.time_control) return

    setTimeControl(newData.time_control)
    setWhiteTimeLeft(newData.white_time_left ?? null)
    setBlackTimeLeft(newData.black_time_left ?? null)
    setLastTimerUpdate(newData.last_timer_update ?? null)
    setTimerStatus(newData.timer_status ?? null)

    myColorRef.current = myColor ?? myColorRef.current
    turnRef.current = newData.turn
    gameOverRef.current = newData.game_state === 'game_over'

    if (newData.game_state !== 'game_over' && newData.timer_status === 'active' && newData.last_timer_update && gameDocId) {
      const turn = newData.turn
      const timeLeft = turn === 'w' ? newData.white_time_left : newData.black_time_left
      if (timeLeft !== null && timeLeft !== undefined) {
        submitTimeoutFlag(flaggingRef, {
          gameDocId,
          turn,
          myColor: myColorRef.current as 'w' | 'b',
          lastTimerUpdate: newData.last_timer_update,
          turnTimeLeft: timeLeft,
        })
      }
    }
  }, [gameDocId])

  const buildTimerUpdate = useCallback((playerColor: 'w' | 'b' | null): Record<string, any> | null => {
    if (!timeControl) return null
    if (!playerColor || !lastTimerUpdate) {
      return { last_timer_update: Date.now(), timer_status: 'active' }
    }

    const now = Date.now()
    const elapsed = Math.max(0, now - lastTimerUpdate)
    const playerTimeKey = playerColor === 'w' ? 'white_time_left' : 'black_time_left'
    const currentTimeLeft = playerColor === 'w' ? whiteTimeLeft : blackTimeLeft

    if (currentTimeLeft === null) {
      return { last_timer_update: now, timer_status: 'active' }
    }

    const timeLeft = Math.max(0, currentTimeLeft - elapsed + (timeControl.increment * 1000))
    return {
      [playerTimeKey]: timeLeft,
      last_timer_update: now,
      timer_status: 'active',
    }
  }, [timeControl, lastTimerUpdate, whiteTimeLeft, blackTimeLeft])

  const isTimeout = useCallback((playerColor: 'w' | 'b' | null): boolean => {
    if (!timeControl || !lastTimerUpdate || !playerColor) return false
    const currentTimeLeft = playerColor === 'w' ? whiteTimeLeft : blackTimeLeft
    if (currentTimeLeft === null) return false
    const elapsed = Math.max(0, Date.now() - lastTimerUpdate)
    return currentTimeLeft - elapsed <= 0
  }, [timeControl, lastTimerUpdate, whiteTimeLeft, blackTimeLeft])

  /**
   * Re-evaluate the clocks locally once a second and whenever the tab
   * becomes visible again. The flag used to be checked only when a
   * Firestore snapshot arrived — but a player who closed the tab never
   * touches the document, so no snapshot ever arrived and the game hung
   * forever. `visibilitychange` covers browsers that throttle background
   * intervals down to once a minute.
   */
  const flagIfTimeout = useCallback(() => {
    if (!gameDocId || gameOverRef.current) return
    if (timerStatus !== 'active' || !lastTimerUpdate) return
    const myColor = myColorRef.current
    const turn = turnRef.current
    if (!myColor || !turn) return
    const turnTimeLeft = turn === 'w' ? whiteTimeLeft : blackTimeLeft
    if (turnTimeLeft === null || turnTimeLeft === undefined) return
    submitTimeoutFlag(flaggingRef, {
      gameDocId,
      turn,
      myColor,
      lastTimerUpdate,
      turnTimeLeft,
    })
  }, [gameDocId, timerStatus, lastTimerUpdate, whiteTimeLeft, blackTimeLeft])

  /**
   * Same guarded write as the interval, but callable the moment a clock
   * visually reaches 0:00 — including by the player who ran out (their
   * own loss; only they lose from a skewed clock). Replaces the old bare
   * updateDoc in GamePage that could overwrite a fresh checkmate/resign.
   */
  const flagTimeoutNow = useCallback(() => {
    if (!gameDocId || gameOverRef.current) return
    if (timerStatus !== 'active' || !lastTimerUpdate) return
    const myColor = myColorRef.current
    const turn = turnRef.current
    if (!myColor || !turn) return
    const turnTimeLeft = turn === 'w' ? whiteTimeLeft : blackTimeLeft
    if (turnTimeLeft === null || turnTimeLeft === undefined) return
    submitTimeoutFlag(flaggingRef, {
      gameDocId,
      turn,
      myColor,
      lastTimerUpdate,
      turnTimeLeft,
      allowSelf: true,
    })
  }, [gameDocId, timerStatus, lastTimerUpdate, whiteTimeLeft, blackTimeLeft])

  useEffect(() => {
    if (!gameDocId) return
    const id = setInterval(flagIfTimeout, 1000)
    const onVisibility = () => {
      if (!document.hidden) flagIfTimeout()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [gameDocId, flagIfTimeout])

  /**
   * Clear all clock state. setTimerFromSnapshot returns early when a document has
   * no `time_control` (classic is untimed by design), so without this a stale
   * clock from a previous rapid room keeps rendering and ticking. GamePage is not
   * remounted when only the /game/:roomId param changes — which is exactly what
   * a rematch or an in-game challenge accept does.
   */
  const resetTimer = useCallback(() => {
    setWhiteTimeLeft(null)
    setBlackTimeLeft(null)
    setLastTimerUpdate(null)
    setTimerStatus(null)
    setTimeControl(null)
    gameOverRef.current = false
    turnRef.current = null
    flaggingRef.current = false
  }, [])

  return {
    whiteTimeLeft,
    blackTimeLeft,
    lastTimerUpdate,
    timerStatus,
    timeControl,
    setTimerFromSnapshot,
    buildTimerUpdate,
    isTimeout,
    flagTimeoutNow,
    resetTimer,
    setWhiteTimeLeft,
    setBlackTimeLeft,
    setLastTimerUpdate,
    setTimerStatus,
    setTimeControl,
  }
}
