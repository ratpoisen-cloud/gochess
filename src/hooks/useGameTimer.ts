import { useState, useCallback } from 'react'
import { doc, runTransaction } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { GameData } from '@/types'

export function useGameTimer(gameDocId: string | null) {
  const [whiteTimeLeft, setWhiteTimeLeft] = useState<number | null>(null)
  const [blackTimeLeft, setBlackTimeLeft] = useState<number | null>(null)
  const [lastTimerUpdate, setLastTimerUpdate] = useState<number | null>(null)
  const [timerStatus, setTimerStatus] = useState<'active' | 'paused' | null>(null)
  const [timeControl, setTimeControl] = useState<GameData['time_control']>(null)

  const setTimerFromSnapshot = useCallback((newData: GameData, myColor: 'w' | 'b' | null) => {
    if (!newData.time_control) return

    setTimeControl(newData.time_control)
    setWhiteTimeLeft(newData.white_time_left ?? null)
    setBlackTimeLeft(newData.black_time_left ?? null)
    setLastTimerUpdate(newData.last_timer_update ?? null)
    setTimerStatus(newData.timer_status ?? null)

    if (newData.game_state !== 'game_over' && newData.timer_status === 'active' && newData.last_timer_update && gameDocId) {
      const now = Date.now()
      const elapsed = now - newData.last_timer_update
      const turn = newData.turn
      const timeLeft = turn === 'w' ? newData.white_time_left : newData.black_time_left

      if (timeLeft !== null && timeLeft !== undefined && (timeLeft - elapsed) <= -1000) {
        if (turn !== myColor) {
          runTransaction(db, async (transaction) => {
            const ref = doc(db, 'games', gameDocId)
            const snap = await transaction.get(ref)
            if (snap.data()?.game_state === 'game_over') return
            transaction.update(ref, {
              game_state: 'game_over',
              winner: myColor === 'w' ? 'white' : 'black',
              message: 'timeout',
            })
          })
        }
      }
    }
  }, [gameDocId])

  const buildTimerUpdate = useCallback((playerColor: 'w' | 'b' | null): Record<string, any> | null => {
    if (!timeControl) return null
    if (!playerColor || !lastTimerUpdate) {
      return { last_timer_update: Date.now(), timer_status: 'active' }
    }

    const now = Date.now()
    const elapsed = now - lastTimerUpdate
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
    const elapsed = Date.now() - lastTimerUpdate
    return currentTimeLeft - elapsed <= 0
  }, [timeControl, lastTimerUpdate, whiteTimeLeft, blackTimeLeft])

  return {
    whiteTimeLeft,
    blackTimeLeft,
    lastTimerUpdate,
    timerStatus,
    timeControl,
    setTimerFromSnapshot,
    buildTimerUpdate,
    isTimeout,
    setWhiteTimeLeft,
    setBlackTimeLeft,
    setLastTimerUpdate,
    setTimerStatus,
    setTimeControl,
  }
}
