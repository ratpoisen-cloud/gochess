import type { SpellState } from '@/lib/spellChessEngine'

/**
 * Squares that currently hold a mine.
 *
 * `SpellState.bombs` is vestigial: the engine initialises it, copies it and
 * clears an entry when a piece steps on it, but never writes one — `castBlast`
 * stores the mine in `pendingBlastMine` instead. Reading `bombs` on its own
 * therefore reports no mines at all, which is what left online Spell Chess
 * showing neither the marker nor the detonation.
 */
export function activeMineSquares(spellState: SpellState | null | undefined): string[] {
  if (!spellState) return []

  const squares = Object.keys(spellState.bombs || {})
  const pending = spellState.pendingBlastMine?.square

  if (pending && !squares.includes(pending)) squares.push(pending)

  return squares
}

/**
 * Mines that were present and are now gone — the ones that just detonated.
 * Returns them in the order they disappeared so effects play in sequence.
 */
export function detonatedMineSquares(
  previous: string[],
  current: string[]
): string[] {
  return previous.filter((square) => !current.includes(square))
}