import { describe, it, expect } from 'vitest'
import { fenPlacement, squareName, findLandedSquare } from '@/lib/boardMove'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

describe('fenPlacement', () => {
  it('раскладывает позицию на 64 клетки', () => {
    const squares = fenPlacement(START)
    expect(squares).toHaveLength(64)
    expect(squares[0]).toBe('r')
    expect(squares[63]).toBe('R')
  })

  it('пустые клетки — пустые строки', () => {
    const squares = fenPlacement(START)
    expect(squares[16]).toBe('')
    expect(squares[27]).toBe('')
    expect(squares[8]).toBe('p')
  })
})

describe('squareName', () => {
  it('переводит индекс клетки в алгебраическую запись', () => {
    expect(squareName(0)).toBe('a8')
    expect(squareName(4)).toBe('e8')
    expect(squareName(36)).toBe('e4')
    expect(squareName(63)).toBe('h1')
  })
})

describe('findLandedSquare', () => {
  it('находит клетку обычного хода', () => {
    const after = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'
    expect(findLandedSquare(START, after)).toBe('e4')
  })

  it('находит клетку взятия', () => {
    const before = 'rnbqkbnr/pppppppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2'
    const after = 'rnbqkbnr/pppppppp/8/3P4/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2'
    expect(findLandedSquare(before, after)).toBe('d5')
  })

  it('находит клетку превращения', () => {
    const before = '8/4P3/8/8/8/8/4K2k/8 w - - 0 1'
    const after = '4Q3/8/8/8/8/8/4K2k/8 b - - 0 1'
    expect(findLandedSquare(before, after)).toBe('e8')
  })

  it('возвращает null при восстановлении партии (изменилось много клеток)', () => {
    const restored = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4'
    expect(findLandedSquare(START, restored)).toBeNull()
  })

  it('возвращает null, когда позиция не изменилась', () => {
    expect(findLandedSquare(START, START)).toBeNull()
  })

  it('возвращает null при взятии «епашта» (три изменившиеся клетки)', () => {
    const before = '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1'
    const after = '4k3/8/3P4/8/8/8/8/4K3 b - - 0 1'
    expect(findLandedSquare(before, after)).toBeNull()
  })
})
