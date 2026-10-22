import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { OpeningFamily } from '@/lib/openingsData'

/**
 * Прогресс пользователя по модулю дебютов (/bot/openings):
 * какие дебюты отработаны в тренажёре, какие в избранном и какой
 * фильтр семейства выбран в справочнике.
 */
export interface OpeningState {
  /** id дебютов, пройденных в тренажёре. */
  studiedOpeningIds: string[]
  /** id избранных дебютов. */
  favoriteOpeningIds: string[]
  /** Выбранное семейство в справочнике. */
  selectedFamily: OpeningFamily | 'all'

  markStudied: (id: string) => void
  toggleFavorite: (id: string) => void
  setFamily: (family: OpeningFamily | 'all') => void
  isStudied: (id: string) => boolean
  isFavorite: (id: string) => boolean
  resetProgress: () => void
}

export const useOpeningStore = create<OpeningState>()(
  persist(
    (set, get) => ({
      studiedOpeningIds: [],
      favoriteOpeningIds: [],
      selectedFamily: 'all',

      markStudied: (id: string) => {
        const { studiedOpeningIds } = get()
        if (studiedOpeningIds.includes(id)) return
        set({ studiedOpeningIds: [...studiedOpeningIds, id] })
      },

      toggleFavorite: (id: string) => {
        const { favoriteOpeningIds } = get()
        set({
          favoriteOpeningIds: favoriteOpeningIds.includes(id)
            ? favoriteOpeningIds.filter((x) => x !== id)
            : [...favoriteOpeningIds, id],
        })
      },

      setFamily: (family: OpeningFamily | 'all') => set({ selectedFamily: family }),

      isStudied: (id: string) => get().studiedOpeningIds.includes(id),
      isFavorite: (id: string) => get().favoriteOpeningIds.includes(id),

      resetProgress: () => set({ studiedOpeningIds: [], favoriteOpeningIds: [] }),
    }),
    {
      name: 'gochess-openings-storage',
    }
  )
)
