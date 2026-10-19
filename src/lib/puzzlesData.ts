export type PuzzleTheme = 
  | 'mate_in_1' 
  | 'mate_in_2' 
  | 'fork' 
  | 'pin' 
  | 'endgame'

export interface Puzzle {
  id: string
  title: string
  theme: PuzzleTheme
  difficulty: 'easy' | 'medium' | 'hard'
  description: string
  fen: string
  playerColor: 'w' | 'b'
  solution: string[] // UCI moves: ['e1e8'] or ['c4g8', 'g8g8', 'h6f7']
  hint: string
  explanation: string
}

export const PUZZLE_THEMES: { id: PuzzleTheme | 'all'; label: string; icon?: string }[] = [
  { id: 'all', label: 'Все задачи' },
  { id: 'mate_in_1', label: 'Мат в 1 ход' },
  { id: 'mate_in_2', label: 'Мат в 2 хода' },
  { id: 'fork', label: 'Вилки и удары' },
  { id: 'pin', label: 'Связки' },
  { id: 'endgame', label: 'Эндшпиль' },
]

export const PUZZLES: Puzzle[] = [
  // ==========================================
  // МАТ В 1 ХОД (MATE IN 1)
  // ==========================================
  {
    id: 'm1-backrank',
    title: 'Мат по 8-й горизонтали',
    theme: 'mate_in_1',
    difficulty: 'easy',
    description: 'Король соперника заперт собственными пешками. Поставьте мат в один ход!',
    fen: '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1',
    playerColor: 'w',
    solution: ['e1e8'],
    hint: 'Атакуйте слабую последнюю горизонталь ладьёй',
    explanation: 'Слабость 8-й горизонтали — классический мотив: пешки f7, g7, h7 отрезают королю путь к спасению.',
  },
  {
    id: 'm1-scholars',
    title: 'Удар по пункту f7',
    theme: 'mate_in_1',
    difficulty: 'easy',
    description: 'Слабый пункт f7 атакован ферзём и слоном. Завершите партию!',
    fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
    playerColor: 'w',
    solution: ['h5f7'],
    hint: 'Ферзь при поддержке белопольного слона готов нанести решающий удар',
    explanation: 'В начале партии пешка f7 защищена только королём. Батарея слона и ферзя ставит быстрый детский мат.',
  },
  {
    id: 'm1-queen-corner',
    title: 'Мат в углу доски',
    theme: 'mate_in_1',
    difficulty: 'easy',
    description: 'Чёрный король загнан в угол на h8. Найдите мат ферзём!',
    fen: '7k/5K1p/6p1/8/8/8/8/7Q w - - 0 1',
    playerColor: 'w',
    solution: ['h1a8'],
    hint: 'Ферзь контролирует всю диагональ a8-h1',
    explanation: 'Ферзь пробивает угол a8 с шахом, а белый король на f7 держит поля g8, g7 и e7.',
  },
  {
    id: 'm1-epaulette',
    title: 'Эполетный мат',
    theme: 'mate_in_1',
    difficulty: 'easy',
    description: 'Собственные ладьи мешают чёрному королю отступить. Объявите мат!',
    fen: '3rkr2/8/8/8/8/8/4Q3/4K3 w - - 0 1',
    playerColor: 'w',
    solution: ['e2e6'],
    hint: 'Ферзь атакует прямо по вертикали «e»',
    explanation: 'Ладьи d8 и f8 зажимают короля с двух сторон подобно эполетам, не давая ему уйти от шаха ферзя.',
  },
  {
    id: 'm1-smothered',
    title: 'Спёртый мат конём',
    theme: 'mate_in_1',
    difficulty: 'medium',
    description: 'Чёрный король окружён своими фигурами на h8. Конь ставит красивый мат!',
    fen: '6rk/6pp/7N/8/8/8/8/7K w - - 0 1',
    playerColor: 'w',
    solution: ['h6f7'],
    hint: 'Конь перепрыгивает через пешки прямо на f7',
    explanation: 'Конь прыгает на f7 и объявляет шах, от которого невозможно защититься, так как королю некуда бежать.',
  },
  {
    id: 'm1-queen-backrank',
    title: 'Прострел ферзя по 8-й линии',
    theme: 'mate_in_1',
    difficulty: 'easy',
    description: 'Пешки d7 и f7 запирают чёрного короля на e8. Поставьте мат ферзём!',
    fen: '4k3/3ppp2/8/8/4Q3/8/5PPP/4K2R w K - 0 1',
    playerColor: 'w',
    solution: ['e4a8'],
    hint: 'Ферзь атакует по открытой 8-й горизонтали',
    explanation: 'Пешки d7, e7, f7 сковали собственного короля на e8, и ферзь наносит неотразимый удар с поля a8.',
  },
  {
    id: 'm1-support-pawn',
    title: 'Поддержка пешки h6',
    theme: 'mate_in_1',
    difficulty: 'easy',
    description: 'Пешка h6 отрезает спасительное поле g7. Завершите партию ладьёй!',
    fen: '6k1/5p1p/6pP/8/8/8/8/4R1K1 w - - 0 1',
    playerColor: 'w',
    solution: ['e1e8'],
    hint: 'Ладья даёт шах по 8-й линии, а пешка h6 контролирует отступление',
    explanation: 'Продвинутая пешка h6 лишает чёрного короля возможности спрятаться на g7.',
  },

  // ==========================================
  // МАТ В 2 ХОДА (MATE IN 2)
  // ==========================================
  {
    id: 'm2-queen-sacrifice-backrank',
    title: 'Жертва ферзя по 8-й линии',
    theme: 'mate_in_2',
    difficulty: 'medium',
    description: 'Сломайте оборону чёрных жертвой ферзя и поставьте линейный мат!',
    fen: '4rqk1/5ppp/8/8/8/8/4QPPP/4R1K1 w - - 0 1',
    playerColor: 'w',
    solution: ['e2e8', 'f8e8', 'e1e8'],
    hint: 'Заберите ладью e8 ферзём с шахом, затем пробейте второй ладьёй',
    explanation: 'Жертва ферзя на e8 выманивает чёрного ферзя, после чего белая ладья ставит неотразимый мат на 8-й горизонтали.',
  },
  {
    id: 'm2-smothered-philidor',
    title: 'Наследие Филидора',
    theme: 'mate_in_2',
    difficulty: 'hard',
    description: 'Легендарная комбинация: пожертвуйте ферзя на g8 и поставьте спёртый мат!',
    fen: '5r1k/6pp/7N/8/2Q5/8/8/7K w - - 0 1',
    playerColor: 'w',
    solution: ['c4g8', 'f8g8', 'h6f7'],
    hint: 'Ферзь объявляет шах на g8 под защиту коня',
    explanation: 'Жертва ферзя Qg8+ вынуждает ладью f8 взять на g8, заперев собственного короля, после чего конь f7 объявляет спёртый мат.',
  },
  {
    id: 'm2-anastasia-mate',
    title: 'Анастасиев мат',
    theme: 'mate_in_2',
    difficulty: 'hard',
    description: 'Жертва ферзя вскрывает вертикаль «h» для решающего удара ладьи!',
    fen: '5r1k/4N1pp/8/7Q/8/3R4/8/6K1 w - - 0 1',
    playerColor: 'w',
    solution: ['h5h7', 'h8h7', 'd3h3'],
    hint: 'Ферзь жертвует собой на поле h7, вскрывая короля',
    explanation: 'Qxh7+ заставляет короля выйти на линию «h», после чего ладья Rh3+ объявляет мат при поддержке коня e7, держащего поля g8 и g6.',
  },
  {
    id: 'm2-arabian-mate',
    title: 'Арабский мат',
    theme: 'mate_in_2',
    difficulty: 'medium',
    description: 'Скоординируйте ладью и коня для мата в углу доски.',
    fen: '6k1/5N2/5K2/8/8/8/8/1R6 w - - 0 1',
    playerColor: 'w',
    solution: ['b1b8', 'g8h7', 'b8h8'],
    hint: 'Ладья даёт шах по 8-й горизонтали, загоняя короля под защиту коня',
    explanation: 'Ладья на h8 защищена конём f7 и атакует короля, в то время как конь и король f6 отрезают все поля отхода.',
  },

  // ==========================================
  // ВИЛКИ И ДВОЙНЫЕ УДАРЫ (FORK)
  // ==========================================
  {
    id: 'fork-knight-royal',
    title: 'Королевская вилка конём',
    theme: 'fork',
    difficulty: 'medium',
    description: 'Найдите неотразимый двойной удар конём на короля и ферзя!',
    fen: '2k1q3/pp3ppp/8/1N6/8/8/PP3PPP/5RK1 w - - 0 1',
    playerColor: 'w',
    solution: ['b5d6'],
    hint: 'Конь прыгает на d6 с шахом',
    explanation: 'Ход Nd6+ объявляет шах королю c8 и одновременно атакует ферзя e8. Чёрный ферзь неизбежно теряется.',
  },
  {
    id: 'fork-pawn-center',
    title: 'Пешечная вилка в центре',
    theme: 'fork',
    difficulty: 'easy',
    description: 'Пешка готова нанести двойной удар по лёгким фигурам соперника.',
    fen: 'r2qk2r/ppp2ppp/2n1b3/8/3P4/5N2/PPP2PPP/R1BQKB1R w KQkq - 0 1',
    playerColor: 'w',
    solution: ['d4d5'],
    hint: 'Двиньте центральную пешку вперёд',
    explanation: 'Пешечный тычок d5 одновременно атакует коня c6 и слона e6, гарантируя белым выигрыш фигуры.',
  },
  {
    id: 'fork-queen-double',
    title: 'Двойной удар ферзём',
    theme: 'fork',
    difficulty: 'medium',
    description: 'Объявите шах королю и одновременно атакуйте незащищённую ладью a8!',
    fen: 'r3k3/p4ppp/8/8/3Q4/8/PP3PPP/4K2R w Kq - 0 1',
    playerColor: 'w',
    solution: ['d4e4'],
    hint: 'Ферзь выходит в центр доски на e4 с шахом',
    explanation: 'Qe4+ даёт шах королю e8 и по открытой диагонали забирает беззащитную ладью a8 следующим ходом.',
  },
  {
    id: 'fork-knight-capture',
    title: 'Взятие ферзя конём',
    theme: 'fork',
    difficulty: 'easy',
    description: 'Конь готов наказать соперника за неосторожный выход ферзя.',
    fen: 'r1b1k2r/pppp1ppp/8/4q3/8/5N2/PPP1PPPP/R2QKB1R w KQkq - 0 1',
    playerColor: 'w',
    solution: ['f3e5'],
    hint: 'Конь f3 может сразу забрать вражеского ферзя',
    explanation: 'Чёрный ферзь остался без защиты в центре доски и конь f3 с лёгкостью забирает его.',
  },

  // ==========================================
  // СВЯЗКИ И ВСКРЫТЫЕ АТАКИ (PIN)
  // ==========================================
  {
    id: 'pin-absolute-queen',
    title: 'Взятие связанного ферзя',
    theme: 'pin',
    difficulty: 'easy',
    description: 'Ферзь чёрных привязан к своему королю на вертикали «e». Заберите его!',
    fen: '4k3/4q3/8/5N2/8/8/4R3/6K1 w - - 0 1',
    playerColor: 'w',
    solution: ['e2e7'],
    hint: 'Ладья забирает ферзя под защитой коня f5',
    explanation: 'Ферзь на e7 связан по вертикали «e» перед королём. Белая ладья забирает ферзя под защитой коня f5, выигрывая сильнейшую фигуру.',
  },
  {
    id: 'pin-bishop-queen',
    title: 'Диагональная связка слоном',
    theme: 'pin',
    difficulty: 'medium',
    description: 'Свяжите ферзя соперника с королём и выиграйте сильнейшую фигуру!',
    fen: '4k3/8/2q5/8/8/8/5PPP/3BK3 w - - 0 1',
    playerColor: 'w',
    solution: ['d1a4'],
    hint: 'Слон выходит на a4, нападая на ферзя по диагонали',
    explanation: 'Ход Ba4 связывает ферзя c6 с королём e8. Ферзь лишён возможности уйти и будет взят на следующем ходу.',
  },
  {
    id: 'pin-discovered-check',
    title: 'Вскрытый двойной шах',
    theme: 'pin',
    difficulty: 'hard',
    description: 'Сделайте ход слоном, чтобы атаковать короля сразу слоном и ладьёй!',
    fen: '3k4/8/8/q7/3B4/8/5PPP/3R2K1 w - - 0 1',
    playerColor: 'w',
    solution: ['d4b6'],
    hint: 'Слон отскакивает на b6, открывая ладью d1',
    explanation: 'Bb6+ объявляет двойной шах от слона и ладьи d1. Король обязан бежать, после чего белые забирают ферзя a5.',
  },

  // ==========================================
  // ЭНДШПИЛЬ (ENDGAME)
  // ==========================================
  {
    id: 'endgame-promotion',
    title: 'Превращение пешки в ферзя',
    theme: 'endgame',
    difficulty: 'easy',
    description: 'Король надёжно прикрывает поле превращения. Проведите пешку в ферзи!',
    fen: '8/3KPk2/8/8/8/8/8/8 w - - 0 1',
    playerColor: 'w',
    solution: ['e7e8q'],
    hint: 'Толкните пешку на e8 и выберите ферзя',
    explanation: 'Пешка e7 при поддержке короля d7 превращается в ферзя с шахом, обеспечивая лёгкую победу.',
  },
  {
    id: 'endgame-opposition',
    title: 'Захват ключевой оппозиции',
    theme: 'endgame',
    difficulty: 'medium',
    description: 'Встаньте королём напротив чужого короля, захватив оппозицию!',
    fen: '8/8/8/3k4/8/4P3/4K3/8 w - - 0 1',
    playerColor: 'w',
    solution: ['e2d3'],
    hint: 'Король идёт на d3 навстречу чёрному королю',
    explanation: 'Ход Kd3 захватывает вертикальную оппозицию: теперь чёрный король должен уступить дорогу белой пешке.',
  },
  {
    id: 'endgame-breakthrough',
    title: 'Прорыв пешки на краю',
    theme: 'endgame',
    difficulty: 'easy',
    description: 'Белая проходная пешка готова сделать решающий шаг к превращению.',
    fen: '8/8/k7/P7/1K6/8/8/8 w - - 0 1',
    playerColor: 'w',
    solution: ['b4a4'],
    hint: 'Поддержите пешку королём',
    explanation: 'Ход Ka4 удерживает ключевую позицию, позволяя пешке безопасно продвинуться дальше.',
  },
]
