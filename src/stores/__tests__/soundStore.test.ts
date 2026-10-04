import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useSoundStore } from '@/stores/soundStore'
import { soundManager } from '@/lib/soundManager'

describe('soundStore', () => {
  beforeEach(() => {
    useSoundStore.setState({ enabled: true, volume: 100 })
    soundManager.setEnabled(true)
    soundManager.setVolume(1)
  })

  it('setEnabled mirrors the state into soundManager', () => {
    useSoundStore.getState().setEnabled(false)
    expect(useSoundStore.getState().enabled).toBe(false)
    expect(soundManager.isEnabled()).toBe(false)

    useSoundStore.getState().setEnabled(true)
    expect(useSoundStore.getState().enabled).toBe(true)
    expect(soundManager.isEnabled()).toBe(true)
  })

  it('setVolume clamps to 0..100 and converts to 0..1 for the manager', () => {
    useSoundStore.getState().setVolume(150)
    expect(useSoundStore.getState().volume).toBe(100)
    expect(soundManager.getVolume()).toBe(1)

    useSoundStore.getState().setVolume(-20)
    expect(useSoundStore.getState().volume).toBe(0)
    expect(soundManager.getVolume()).toBe(0)

    useSoundStore.getState().setVolume(40)
    expect(useSoundStore.getState().volume).toBe(40)
    expect(soundManager.getVolume()).toBeCloseTo(0.4)
  })

  it('does not play sounds when muted or at zero volume', () => {
    useSoundStore.getState().setEnabled(false)
    const spy = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    soundManager.play('move')
    expect(spy).not.toHaveBeenCalled()

    useSoundStore.getState().setEnabled(true)
    useSoundStore.getState().setVolume(0)
    soundManager.play('move')
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('soundManager preferences', () => {
  it('loads enabled and volume from persisted settings at startup', async () => {
    localStorage.setItem(
      'gochess-sound-settings',
      JSON.stringify({ state: { enabled: false, volume: 40 }, version: 0 })
    )
    vi.resetModules()
    const fresh = await import('@/lib/soundManager')
    expect(fresh.soundManager.isEnabled()).toBe(false)
    expect(fresh.soundManager.getVolume()).toBeCloseTo(0.4)
    localStorage.removeItem('gochess-sound-settings')
    vi.resetModules()
  })
})
