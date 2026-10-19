export interface Puzzle {
  id: string
  title: string
  difficulty: 'easy' | 'medium' | 'hard'
  description: string
  fen: string
  playerColor: 'w' | 'b'
  solution: string[] // UCI moves: ['e1e8'] or ['h5f7'] or ['e1e8', 'a8e8', 'f1f8']
  hint: string
}

export const PUZZLES: Puzzle[] = [
  {
    id: 'mate-in-1-backrank',
    title: 'Мат по 8-й горизонтали',
    difficulty: 'easy',
    description: 'Король соперника заперт собственными пешками. Поставьте мат в 1 ход!',
    fen: '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1',
    playerColor: 'w',
    solution: ['e1e8'],
    hint: 'Атакуйте слабую последнюю горизонталь ладьёй',
  },
  {
    id: 'mate-in-1-scholars',
    title: 'Удар по f7',
    difficulty: 'easy',
    description: 'Слабый пункт f7 не защищён фигурами чёрных. Поставьте мат в 1 ход!',
    fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
    playerColor: 'w',
    solution: ['h5f7'],
    hint: 'Ферзь при поддержке слона готов нанести решающий удар',
  },
  {
    id: 'mate-in-1-queen-corner',
    title: 'Мат в углу',
    difficulty: 'easy',
    description: 'Чёрный король загнан в угол доски. Завершите партию одним ударом!',
    fen: '7k/5K1p/6p1/8/8/8/8/7Q w - - 0 1',
    playerColor: 'w',
    solution: ['h1a8'],
    hint: 'Ферзь контролирует всю дальнюю диагональ',
  },
  {
    id: 'mate-in-1-anastasia',
    title: 'Мат ладьёй по 8-й линии',
    difficulty: 'easy',
    description: 'Чёрный король ограничен ладьёй на f8. Захватите последнюю горизонталь!',
    fen: '5rk1/1p3ppp/8/8/8/8/8/4R1K1 w - - 0 1',
    playerColor: 'w',
    solution: ['e1e8'],
    hint: 'Ладья нападает на короля по открытой вертикали',
  },
  {
    id: 'mate-in-1-epaulette',
    title: 'Эполетный мат',
    difficulty: 'easy',
    description: 'Собственные ладьи мешают чёрному королю отступить. Объявите мат!',
    fen: '3rkr2/8/8/8/8/8/4Q3/4K3 w - - 0 1',
    playerColor: 'w',
    solution: ['e2e6'],
    hint: 'Ферзь атакует прямо по вертикали «e»',
  },
  {
    id: 'tactics-knight-fork',
    title: 'Взятие ферзя',
    difficulty: 'medium',
    description: 'Найдите лучший тактический ход за белых!',
    fen: 'r1b1k2r/pppp1ppp/8/4q3/8/5N2/PPP1PPPP/R2QKB1R w KQkq - 0 1',
    playerColor: 'w',
    solution: ['f3e5'],
    hint: 'Конь может бесплатно забрать сильнейшую фигуру соперника',
  },
  {
    id: 'mate-in-1-rook-pawn',
    title: 'Поддержка пешки',
    difficulty: 'easy',
    description: 'Белая пешка на g6 контролирует поле f7. Поставьте мат ладьёй!',
    fen: '5r1k/7p/6P1/8/8/8/8/R6K w - - 0 1',
    playerColor: 'w',
    solution: ['a1a8'],
    hint: 'Ладья атакует по 8-й горизонтали',
  },
  {
    id: 'tactics-bishop-skewer',
    title: 'Взятие ладьи',
    difficulty: 'medium',
    description: 'Слон на c3 готов нанести решающий удар!',
    fen: '4k3/8/8/8/8/2B5/8/r3K3 w - - 0 1',
    playerColor: 'w',
    solution: ['c3a1'],
    hint: 'Слон может сразу забрать атакующую ладью',
  },
  {
    id: 'mate-in-1-smothered',
    title: 'Спёртый мат конём',
    difficulty: 'hard',
    description: 'Чёрный король окружён своими фигурами на h8. Конь ставит красивый мат!',
    fen: '6rk/6pp/7N/8/8/8/8/7K w - - 0 1',
    playerColor: 'w',
    solution: ['h6f7'],
    hint: 'Конь прыгает на f7, атакуя короля, которому некуда бежать',
  },
]
