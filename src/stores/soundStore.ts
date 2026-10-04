import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { soundManager } from '@/lib/soundManager'

interface SoundState {
  enabled: boolean
  volume: number
  setEnabled: (enabled: boolean) => void
  setVolume: (volume: number) => void
}

export const useSoundStore = create<SoundState>()(
  persist(
    (set) => ({
      enabled: true,
      volume: 100,

      setEnabled: (enabled) => {
        soundManager.setEnabled(enabled)
        set({ enabled })
      },

      setVolume: (volume) => {
        const clamped = Math.min(100, Math.max(0, Math.round(volume)))
        soundManager.setVolume(clamped / 100)
        set({ volume: clamped })
      },
    }),
    {
      name: 'gochess-sound-settings',
    }
  )
)

const initial = useSoundStore.getState()
soundManager.setEnabled(initial.enabled)
soundManager.setVolume(initial.volume / 100)
