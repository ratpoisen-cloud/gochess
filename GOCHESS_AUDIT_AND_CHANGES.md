# GoChess — отчёт о внесённых изменениях и аудит проекта

**Дата:** 1 октября 2026
**Проект:** `/Users/ratposen/Documents/gochess` (React 18 + TypeScript + Vite, шахматы с ботом и магией)
**Состояние:** изменения внесены **только локально**, ничего не закоммичено и не задеплоено

> Этот файл самодостаточен: он содержит всё необходимое, чтобы продолжить работу на другом устройстве. Ничего из описанного ниже не требует доступа к моей сессии.

---

## Содержание

- [0. Что нужно сделать сразу](#0-что-нужно-сделать-сразу)
- [1. Окружение и предусловия](#1-окружение-и-предусловия)
- [2. Что изменено и почему](#2-что-изменено-и-почему)
  - [2.1 Онлайн Spell Chess не работал вообще](#21-онлайн-spell-chess-не-работал-вообще-критично)
  - [2.2 Заклинания не сохранялись в Firestore](#22-заклинания-не-сохранялись-в-firestore)
  - [2.3 Реванш был неиграем](#23-реванш-был-неиграем)
  - [2.4 Atomic: потеря истории и нераспознанная победа](#24-atomic-потеря-истории-и-нераспознанная-победа)
  - [2.5 Отсутствовали составные индексы Firestore](#25-отсутствовали-составные-индексы-firestore)
  - [2.6 Падения и рассинхрон в useGameSync](#26-падения-и-рассинхрон-в-usesync)
  - [2.7 Баги движка (PoisenChess)](#27-баги-движка-poisenchess)
  - [2.8 Баги интерфейса](#28-баги-интерфейса)
  - [2.9 Сборка и деплой](#29-сборка-и-деплой)
- [2.10 Классическая онлайн-игра: часы, звук, результат](#210-классическая-онлайн-игра-часы-звук-результат)
- [2.11 Реванш: гибридный вызов](#211-реванш-гибридный-вызов)
- [2.12 CI/CD и GitHub Pages](#212-cicd-и-github-pages)
- [2.13 Аудит магических шахмат: онлайн и оффлайн разошлись до разных продуктов](#213-аудит-магических-шахмат-онлайн-и-офлайн-разошлись-до-разных-продуктов)
- [3. Новые тесты](#3-новые-тесты)
- [4. Аудит: оставшиеся находки и решения](#4-аудит-оставшиеся-находки-и-решения)
- [5. Отложено сознательно](#5-отложено-сознательно)
- [6. Проверка изменений](#6-проверка-изменений)

---

## 0. Что нужно сделать сразу

Три вещи, без которых правки не работают в живом приложении:

| # | Действие | Почему |
|---|---|---|
| 1 | `firebase deploy --only firestore:indexes` | 4 составных индекса лежат только в `firestore.indexes.json`. Без деплоя приложение падает на `FAILED_PRECONDITION` — модалка входящих вызовов и список последних партий онлайн остаются сломанными |
| 2 | Создать `.env.local` с 6 ключами Firebase | Без них `src/lib/firebase.ts` ловит исключение, `auth` и `db` остаются `null`, любое обращение к Firestore падает. Файл `.env.local` находится в `.gitignore` и не должен попадать в репозиторий |
| 3 | Перенести изменения в репозиторий | Каталог не является git-репозиторием, `git` не установлен |

Поля для `.env.local` (из `src/lib/firebase.ts:6-11`):

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

---

## 1. Окружение и предусловия

### Что было

- `node` и `npm` **не установлены**
- `git` не установлен (нет Xcode Command Line Tools)
- `nvm` отказывается ставиться: его скрипт требует Xcode CLT
- `node_modules` отсутствовал (992 пакета ещё не были установлены)
- `tsconfig.json` **исключает** `src/**/__tests__/**` из проверки типов

### Что установлено локально (вне репозитория)

| Что | Где | Размер |
|---|---|---|
| Node 20.20.2 + npm 10.8.2 | `~/.local/node` | 166 МБ |
| Одна строка в `~/.zshrc` | `export PATH="$HOME/.local/node/bin:$PATH"` | — |

Node ставился из официального tarball `node-v20.20.2-darwin-x64.tar.gz` с проверкой SHA-256 по `SHASUMS256.txt` (совпал). macOS x86_64, `brew` отсутствует.

**На другом устройстве:** если Node уже есть — ничего делать не нужно. `node_modules` (558 МБ) в репозиторий не попадёт, он в `.gitignore`.

### Что добавлено в проект как служебное

- `.gitignore` — `node_modules`, `dist`, `.env*`, `.DS_Store`, логи. Создан **до** `npm install`, чтобы ключи и зависимости физически не могли попасть в коммит
- `.env.example` — шаблон с пустыми значениями, без секретов

---

## 2. Что изменено и почему

Всего 16 файлов. Ниже — по каждому: что было сломано, доказательство, что сделано.

---

### 2.1 Онлайн Spell Chess не работал вообще (критично)

**Это самая крупная находка. До фикса онлайн-магия была нефункциональна.**

#### Цепочка бага

| Шаг | Место | Факт |
|---|---|---|
| 1 | `src/hooks/useGameSync.ts:515` | На **каждом** ходу движок пересоздаётся: `createEngine('spell', fen)` + `applySpellStateJSON` |
| 2 | `src/lib/spellChessEngine.ts:720` (было) | `fen()` жёстко писал `res += ' KQkq - 0 1'` — поле 5 (fullmove) **всегда 1** |
| 3 | `src/lib/spellChessEngine.ts:128-129` | `load()` выводит счётчик полуходов из fullmove: `(fullmoveNum - 1) * 2 + …` → **всегда 0 или 1** |
| 4 | `src/lib/spellChessEngine.ts:52-62, 900` (было) | В `SpellState` **не было** поля счётчика, а `spellStateToJSON()` сериализует только `spellState` → значение **не восстанавливалось** |
| 5 | `src/lib/spellChessEngine.ts:105, 396` | `getTurnNumber() = halfMoveCount + 1` → всегда 1–2. `canAffordSpell` режет: `if (currentTurnNum < SPELL_UNLOCK[spell]) return 'locked'` |

#### Следствие: 8 из 9 заклинаний заблокированы навсегда

| Заклинание | Порог `SPELL_UNLOCK` | Реальный номер хода | Итог |
|---|---|---|---|
| `jump` | 1 | 1–2 | работало |
| `shield` | 7 | 1–2 | **заблокировано** |
| `berserk` | 13 | 1–2 | **заблокировано** |
| `freeze` | 19 | 1–2 | **заблокировано** |
| `portal` | 19 | 1–2 | **заблокировано** |
| `divineGrace` | 25 | 1–2 | **заблокировано** |
| `shadowGrave` | 25 | 1–2 | **заблокировано** |
| `mirage` | 25 | 1–2 | **заблокировано** |
| `blast` | 31 | 1–2 | **заблокировано** |

Три следствия из того же корня:

- **PGN уничтожался.** `useGameSync.ts:542` писал `pgn: g.pgn()`, а `pgn()` (строка 846) итерирует `moveStack`, пустой у свежего движка → в Firestore писалась пустая строка **на первом же ходу**
- **`GamePage.tsx:342`** `turnNumber = Math.floor(moveHistory.length / 2) + 1`, а `moveHistory` = `[]` (строка 125) → всегда 1
- **`GamePage.tsx:399`** `halfMoveCount = moveHistory.length` → всегда 0 → **подсветки заморозки, щита, портала и непроходимости не истекали никогда** (строки 400–443 сравнивают `expiry > 0`)

**Почему баг не замечали:** локальный Spell Chess работал, потому что там движок — персистентный синглтон в `spellGameStore`, и счётчик накапливался. Онлайн и локальный режимы вели себя по-разному.

#### Что сделано

**1. Счётчик перенесён внутрь `SpellState`** — `src/lib/spellChessEngine.ts:53-64`

```ts
export interface SpellState {
  halfMoveCount: number;   // ← новое поле
  frozenSquares: Record<string, number>;
  // …остальное без изменений
}
```

**2. `halfMoveCount` стал геттером/сеттером поверх `spellState`** — строки 85–93

```ts
// Proxied through spellState so spellStateToJSON() persists it. Every read
// site keeps working unchanged.
get halfMoveCount(): number {
  return this.spellState.halfMoveCount
}

set halfMoveCount(value: number) {
  this.spellState.halfMoveCount = value
}
```

Ключевая идея: поле используется в **26 местах** движка, все как `this.halfMoveCount`. Через геттер/сеттер все 26 мест продолжают работать без единой правки, а значение автоматически попадает в `spell_state_json` (сериализуется весь объект `spellState`). Конструктор теперь инициализирует `spellState` раньше, чем счётчик, иначе сеттер писал бы в `undefined`.

**3. `fen()` пишет настоящий fullmove и валидную рокировку** — строки 734–742

```ts
// Spell Chess has no castling and no en-passant, so those fields must be
// '-' rather than 'KQkq': this FEN is fed to PoisenChessEngine as a
// fallback in useGameRequest/useGameSync, and bogus castling rights there
// generate illegal moves. The fullmove number must be real because load()
// derives halfMoveCount from it.
const fullmove = Math.floor(this.halfMoveCount / 2) + 1
res += ` ${this._turn} - - 0 ${fullmove}`
```

**4. `applySpellStateJSON` — восстановление с фолбэком** — строки 925–948

```ts
const parsed = JSON.parse(json) as Partial<SpellState>
this.spellState = {
  ...parsed,
  // Documents written before halfMoveCount moved into SpellState have no
  // such field. Keep whatever load() derived from the FEN fullmove number
  // instead of resetting the ply counter to 0.
  halfMoveCount:
    typeof parsed.halfMoveCount === 'number'
      ? parsed.halfMoveCount
      : this.spellState.halfMoveCount ?? 0,
  // …
}
```

**5. `deepCloneSpellState`** (строка 759) — третий клон состояния, использовался для записи в `moveStack`. Без нового поля `undo()` терял бы счётчик.

**6. `GamePage.tsx:342-348`** — `turnNumber` из `spellState`:

```ts
// In Spell Chess the engine is rebuilt from FEN on every ply, so moveHistory
// is always empty online — the ply counter must come from the spell state.
const spellPlyCount = isSpellMode ? (parsedSpellState?.halfMoveCount ?? 0) : null

const turnNumber = spellPlyCount !== null
  ? spellPlyCount + 1
  : Math.floor(moveHistory.length / 2) + 1
```

**7. `GamePage.tsx:405`** — то же для подсветок (`const halfMoveCount = spellPlyCount ?? 0`)
**8. `GamePage.tsx:856`** — счётчик «N полуходов» в списке ходов
**9. `GamePage.tsx:453`** — в dep-массив `spellCustomSquareStyles` добавлен `spellPlyCount`

#### Попутно исправлено

В `applySpellStateJSON` было `charges: { w: { ...parsed.charges?.w } }`. При отсутствии поля это давало `{}`, и `canAffordSpell` возвращал `'charges'` для **всех** заклинаний — то есть второй, независимый путь к полной блокировке. Теперь мерджится поверх дефолтов:

```ts
charges: {
  w: { ...defaultCharges('w'), ...(parsed.charges?.w || {}) },
  b: { ...defaultCharges('b'), ...(parsed.charges?.b || {}) },
},
```

Также убран `any` (правило 10 проекта), добавлены `?? {}` на nullable-поля и `parsed` типизирован как `Partial<SpellState>`.

---

### 2.2 Заклинания не сохранялись в Firestore

**Файл:** `src/hooks/useGameSync.ts`, функция `castSpell`

#### Что было сломано

`preMoveTurn` читался **после** `updateGameState(g)`:

```
722:  updateGameState(g)          ← оптимистичное обновление
...
731:  const preMoveTurn = gameRef.current.turn()   ← очередь УЖЕ переключена
...
756:  if (freshData.turn !== preMoveTurn) return 'stale'
```

Заклинания `freeze`, `blast`, `berserk`, `divineGrace`, `shadowGrave`, `mirage` вызывают `completeTurn()` (`spellChessEngine.ts:406-407`), который переключает очередь. Поэтому `preMoveTurn` содержал цвет **соперника**, а `freshData.turn` — кастера. Guard **всегда** давал `'stale'`, а возвращаемое значение транзакции **выбрасывалось** (строки 751–758 не присваивались).

**Итог:** 6 из 9 заклинаний применялись локально и **исчезали на следующем снапшоте**. Запись в базу не происходила вообще.

Корректный образец уже существовал в той же файле — `makeMove` на строках 489–491 захватывал значения до обновления.

#### Что сделано

- Строки 746–748: захват `prevFen` / `prevSsj` / `preMoveTurn` перенесён **до** каста и до `updateGameState`
- Строки 786–802: результат транзакции теперь **принимается**, и при `'stale'` / `'error'` происходит откат:

```ts
const txnResult = await runTransaction(db, async (transaction) => {
  const freshDoc = await transaction.get(gameRef2)
  const freshData = freshDoc.data()
  if (!freshData) return 'error'
  if (freshData.turn !== preMoveTurn && !gameOverNow) return 'stale'
  transaction.update(gameRef2, updateData)
  return 'ok'
})

if (txnResult === 'stale' || txnResult === 'error') {
  localMoveRef.current = false
  const rollback = createEngine('spell', prevFen || undefined)
  if (prevSsj) { (rollback as any).applySpellStateJSON?.(prevSsj) }
  updateGameState(rollback)
  lastSpellStateJsonRef.current = prevSsj
  setSpellStateJson(prevSsj)
  setIsMyTurn(true)
  setHasCastSpellThisTurn(false)
  addToast('Ошибка синхронизации хода', 'error')
  return false
}
```

- Устранено затенение `preMoveTurn` во free-ветке (строка 783) — она объявляла собственную переменную
- Убран дубль `soundManager.play('move')`: он был и в добавленной ветке, и глобально на строке 849

---

### 2.3 Реванш был неиграем

**Файл:** `src/hooks/useRematch.ts:50-54`

#### Что было сломано

Две ошибки в трёх строках:

```ts
white_time_left: data.time_control?.base || null,      // ← секунды, а не мс
black_time_left: data.time_control?.base || null,      // ← то же
last_timer_update: serverTimestamp(),                  // ← Timestamp в числовое поле
```

- `time_control.base` по всем остальным путям хранится в **секундах** (`ColorPickerModal.tsx:34`), а `white_time_left` — в **миллисекундах** (`ColorPickerModal.tsx:142` пишет `base * 1000`). Часы стартовали в 1000 раз меньше.
- `last_timer_update` объявлен в `src/types/index.ts:44` как `number | null`, но писался `serverTimestamp()` → Firestore `Timestamp`. `useGameTimer.ts:24,52` читает его как число: `Date.now() - {seconds, nanoseconds}` → `NaN` → `Math.max(0, x - NaN + inc)` → `NaN` → **Firestore отклоняет запись**.

**Итог: каждый ход в реванше падал с «Ошибка синхронизации хода». Партия была неиграема.**

#### Что сделано

```ts
time_control: data.time_control || null,
white_time_left: data.time_control ? data.time_control.base * 1000 : null,
black_time_left: data.time_control ? data.time_control.base * 1000 : null,
last_timer_update: Date.now(),
timer_status: data.time_control ? 'active' : null,
```

`serverTimestamp` остался в импорте — он корректен для `created_at` и `last_move_time`, которые используются как Timestamp.

---

### 2.4 Atomic: потеря истории и нераспознанная победа

**Файлы:** `src/lib/engine/AtomicChessEngine.ts`, `src/lib/engine/PoisenChess.ts`

#### Проблема 1 — потеря истории партии

```ts
// было, AtomicChessEngine.ts:44
if (!myKing) {
  this.load(previousFen)   // ← load() обнуляет всё
  return null
}
```

`PoisenChess.load():39-45` сбрасывает `_history`, `positionCount`, `_gameResult`, castling, ep и часы. Отклонённый ход **уничтожал запись партии**, `undo()` становился no-op, счётчики повторений обнулялись.

**Исправление** — использовать `undo()`, который восстанавливает всё из записи истории и **сохраняет** историю партии:

```ts
if (!myKing) {
  this.undo()
  return null
}
```

Побочные детали: удалена переменная `previousFen` (стала неиспользуемой), взрыв уже сделанные с доски удаления откатываются корректно, потому что `undo()` присваивает `this._board = entry.board` — полный снимок до хода.

#### Проблема 2 — победа по взятию короля не считалась концом игры

```ts
// PoisenChess.ts, было
isGameOver(): boolean {
  return this.isCheckmate() || this.isStalemate() || this.isDraw()
}
```

После взрыва, уничтожившего короля соперника: `inCheck()` возвращает `false` (короля нет → `kingSquare` вернул `null` → ранний выход), `hasLegalMove()` может найти ходы → `isStalemate()` ложно, `isDraw()` ложно. **Ни один из трёх термов не срабатывал — `isGameOver()` возвращал `false`.** Atomic-партия по взятию короля вообще не считалась завершённой.

**Исправление** — добавлена проверка наличия обоих королей (`PoisenChess.ts:720`):

```ts
private hasBothKings(): boolean {
  return this.kingSquare('w') !== null && this.kingSquare('b') !== null
}

isStalemate(): boolean {
  if (!this.hasBothKings()) return false
  if (this.inCheck()) return false
  return !this.hasLegalMove()
}

isDraw(): boolean {
  if (!this.hasBothKings()) return false
  // …прежняя логика
}

isGameOver(): boolean {
  if (!this.hasBothKings()) return true
  return this.isCheckmate() || this.isStalemate() || this.isDraw()
}
```

`isCheckmate()` проверять не нужно: при отсутствии короля `inCheck()` уже возвращает `false`.

Проверено на регрессию: все stalemate/draw-тесты в `gameStore.test.ts` используют позиции с обоими королями, поведение не изменилось.

---

### 2.5 Отсутствовали составные индексы Firestore

**Файл:** `firestore.indexes.json` (был пустым — `{"indexes": [], "fieldOverrides": []}`)

#### Что было сломано

Проверены **все 11** запросов в проекте. Требовали составного индекса ровно 4:

| Место | Запрос | Симптом |
|---|---|---|
| `useChallenges.ts:22-25` | `where(toId) + where(status) + orderBy(createdAt)` | **модалка входящих вызовов не открывается** |
| `useChallenges.ts:47-51` | `where(fromId) + where(status) + orderBy(createdAt)` | авто-переход по принятому вызову не срабатывает |
| `OnlineHubPage.tsx:63-66` | `where(white_player_id) + orderBy(created_at)` | **список «Последние партии онлайн» всегда пуст** |
| `OnlineHubPage.tsx:69-72` | `where(black_player_id) + orderBy(created_at)` | то же для чёрных |

Остальные запросы (`ColorPickerModal.tsx:112`, `useRoomJoin.ts:36`, `LobbyPage.tsx:139,144`, `CompletedGamesPage.tsx:27,33`, `OnlineHubPage.tsx:97`) используют только equality-фильтры и покрываются одно-полевыми индексами через zig-zag merge.

Здесь же зафиксирован **существующий баг**: `OnlineHubPage.tsx:60` содержит комментарий «matching LobbyPage logic to use existing indexes», но у `LobbyPage.tsx:139` `orderBy` **отсутствует** — именно поэтому тот запрос и работает. Комментарий вводит в заблуждение.

#### Что сделано

Добавлены 4 индекса (по `collectionGroup`, `queryScope: COLLECTION`), для полей равенства порядок `ASCENDING`, для сортируемого поля `DESCENDING`.

**Требует `firebase deploy --only firestore:indexes`** — без этого в коде исправлено, но в приложении не работает.

---

### 2.6 Падения и рассинхрон в useGameSync

**Файл:** `src/hooks/useGameSync.ts`

#### 1. `loadPgn` вне `try` (строка 599)

Было:
```ts
const g = createEngine()
if (gameRef.current.pgn()) {
  g.loadPgn(gameRef.current.pgn())   // ← вне try
}
```

Битый локальный PGN выбрасывал исключение из `async`-функции → unhandled rejection. Стало:
```ts
const g = createEngine()
const currentPgn = gameRef.current.pgn()
if (currentPgn) {
  try {
    g.loadPgn(currentPgn)
  } catch {
    const currentFen = gameRef.current.fen()
    if (currentFen) g.load(currentFen)
  }
}
```

#### 2. Неприкрытый `JSON.parse` (строки 250 и 179)

`applySpellStateJSON` делает `JSON.parse(json)` без `try`. Атомарный аналог был обёрнут, а spell-ветка — нет. Поскольку `firestore.rules` разрешает игроку писать `spell_state_json`, **соперник мог навсегда сломать твою страницу**. Обернуто в обоих местах, включая ветку game-over:

```ts
if (newData.spell_state_json) {
  try {
    ;(g as any).applySpellStateJSON?.(newData.spell_state_json)
  } catch {
    // Malformed spell state from a remote write — keep the position from FEN
  }
}
```

#### 3. Refs не сбрасывались при смене комнаты (строки 368–393)

`lastSpellStateJsonRef`, `lastPgnRef`, `initialSnapshotRef`, `lastReactionTimestampRef`, `gameRef`, `localMoveRef` переживали смену комнаты. `useRematch` делает `navigate('/game/{newId}')`, `GamePage` остаётся смонтированным. Ветка ре-инициализации spell требует `lastSpellStateJsonRef.current === null` — условие не выполнялось, поэтому **spell-реванш рендерил старую доску**. Добавлен эффект с `prevRoomCodeRef`.

---

### 2.7 Баги движка (PoisenChess)

**Файл:** `src/lib/engine/PoisenChess.ts`

#### 1. `moves({square})` не фильтровал по цвету (строка 461)

```ts
// было
const pieces = targetSquare
  ? [[targetSquare, this.get(targetSquare)] as const].filter(([_, p]) => p)
  : /* полный список — с проверкой p.color === this._turn */
```

Ветка `targetSquare` проверяла только наличие фигуры. `moves({square: <фигура соперника>})` возвращала **хода соперника**. Достижимо из `ChessBoard.tsx:114` (hover-превью, без проверки цвета). Исправлено по образцу второй ветки:

```ts
const pieces = targetSquare
  ? [[targetSquare, this.get(targetSquare)] as const].filter(
      ([_, p]) => p && p.color === this._turn
    )
  : this._board.flatMap(...)
```

Заодно устранило расхождение между движками: `SpellChessEngine.moves()` проверку цвета уже имел.

#### 2. `isSquareAttacked` считал клетку атакованной самой собой (строка 187)

```ts
case 'k':
  if (adr <= 1 && adc <= 1) return true     // ← нет исключения самой клетки
```

Сейчас недостижимо (атакующий всегда другого цвета), но копия этой функции в `spellChessEngine.ts:222` проверку имеет — расхождение между двумя реализациями. Стало `if (adr <= 1 && adc <= 1 && (adr > 0 || adc > 0)) return true`.

---

### 2.8 Баги интерфейса

| Файл | Проблема | Исправление |
|---|---|---|
| `SpellBar.tsx:24-32` | 4 пропа принимались и **выбрасывались** через `void _x`; `SpellTile` вообще не имел `disabled` → тайлы заклинаний выглядели и работали как доступные **всегда**, включая конец партии и чужой ход. Клик давал тост в никуда | Пропы используются по назначению, добавлен расчёт `canCast` и `disabled` |
| `SpellTile.tsx` | Нет атрибута `disabled`, нет `type="button"` | Добавлены `disabled`, `cursor-default opacity-50`, `type="button"` |
| `SpellBar.tsx:44-50` | Cleanup снимал только `scroll`, но не `touchstart` → слушатель с `setTooltip` на размонтированном компоненте оставался на `window` навсегда | Cleanup снимает оба |
| `usePgnCopy.ts:12` | `navigator.clipboard.writeText` **не ожидался** → тост «PGN скопирован» показывался при отказе (незащищённый контекст, отказ Safari, неактивная вкладка) | `await`, `catch` показывает «Ошибка копирования» |
| `GamePage.tsx:795-801` | То же для копирования URL комнаты | `await` + `catch` |
| `App.tsx:19-25` | **Мёртвый код.** Читал `sessionStorage.getItem('gochess-redirect')` в `useEffect`, но `main.tsx:18-26` читает тот же ключ **синхронно до рендера** и удаляет его → ключ всегда пуст. Причём `navigate(saved)` передал бы путь **с** basename в роутер, который basename срезает сам | Удалён вместе с `useNavigate`/`useEffect` |
| `OnlineHubPage.tsx:148` | `ModeTile` объявлен **внутри тела компонента** → новая функция на каждом рендере → React сравнивает `type` по идентичности → **все 5 тайлов ремонтировались при каждом рендере**, теряя CSS-переходы и hover-состояние | Вынесен на модульный уровень, обработчик передан пропом `onSelect` |
| `OfflineHubPage.tsx:29` | То же, 4 тайла | Вынесен на модульный уровень (замыканий не имел) |
| `useGameSync.ts:738, 772` | Дублирующиеся магические массивы заклинаний | Заменены на экспорт движка `FREE_ACTIONS` / `TERMINAL_ACTIONS` |

---

### 2.9 Сборка и деплой

#### 1. `public/404.html` — бесконечный редирект в dev

Файл хардкодил `/gochess`:

```js
if (path !== '/gochess/' && path !== '/gochess') { … }
window.location.href = '/gochess'
```

`vite.config.ts:8` давно сделали параметризуемым (`base: process.env.VITE_BASE || '/'`), а `404.html` — нет. При `base: '/'` любой 404 уводил на `localhost:5173/gochess` → снова 404 → бесконечный цикл.

Файлы в `public/` копируются дословно, поэтому `%BASE_URL%` (как в `index.html:13`) там не работает. Решение — подстановка на этапе сборки.

**`public/404.html`** теперь содержит плейсхолдер `__GOCHESS_BASE__`.

**`vite.config.ts`** — новый плагин:

```ts
// Files in public/ are copied verbatim, so they cannot use Vite's %BASE_URL%
// placeholder. Substitute build-time values on the way out instead:
//  - 404.html needs the deployment base for its SPA redirect
//  - sw.js needs a cache version so that a deploy invalidates the static cache
function injectBuildConstants(base: string): Plugin {
  const version = String(Date.now())
  return {
    name: 'gochess-inject-build-constants',
    apply: 'build',
    closeBundle() {
      const replace = (file: string, pairs: [string, string][]) => {
        const full = path.resolve(__dirname, 'dist', file)
        if (!fs.existsSync(full)) return
        let content = fs.readFileSync(full, 'utf8')
        for (const [from, to] of pairs) content = content.split(from).join(to)
        fs.writeFileSync(full, content)
      }

      replace('404.html', [['__GOCHESS_BASE__', base]])
      replace('sw.js', [
        ['__GOCHESS_VERSION__', version],
        ['__GOCHESS_BASE__', base],
      ])
    },
  }
}
```

`defineConfig` переведён на форму с функцией, возвращающей конфигурацию.

**Проверено сборкой:** в `dist/404.html` → `var base = '/gochess/'`; в `dist/sw.js` → `BASE = '/gochess/'`, `VERSION = '1790769950130'`; плейсхолдеров в `dist/` не осталось.

#### 2. `public/sw.js` — кэш без версии

Было `const STATIC_CACHE = 'gochess-static-v1'` — фиксированное имя. Иконки, звуки и фигуры кешировались **навсегда** без ревалидации; исправление сломанной иконки требовало ручной правки константы.

Теперь версия подставляется на сборке (`__GOCHESS_VERSION__`), поэтому любой деплой сам инвалидирует кэш. Также:
- добавлена проверка `url.pathname.startsWith(SCOPE_PATH)` — SW не перехватывает запросы вне своей области
- `caches.put` обёрнут в `catch` — раньше отказ квоты давал unhandled rejection
- сохранены исправления 206 Partial Response (строки 26, 38 в старой версии) — Cache API не поддерживает 206

---

### 2.10 Классическая онлайн-игра: часы, звук, результат

Аудит отдельно по классике/рапиду (`game_mode: 'classic' | 'rapid'`). Ветки spell/atomic исключены.

#### P0 — часы списывали время соперника на ваши

**`src/components/board/ChessTimer.tsx:25-50`**

```ts
useEffect(() => { setLocalTime(timeLeft); lastTickRef.current = Date.now() }, [timeLeft])  // было
useEffect(() => {
  if (!isActive) return
  const interval = setInterval(() => {
    const delta = Date.now() - lastTickRef.current   // НЕОГРАНИЧЕННЫЙ
```

`lastTickRef` сбрасывался **только** при изменении пропа `timeLeft`. Но `buildTimerUpdate` (`useGameTimer.ts:53`) пишет **только ключ ходившего**, поэтому ваш `white_time_left` во время хода соперника не меняется → эффект по `[timeLeft]` не срабатывает → при включении таймера `delta` равен всему времени размышления соперника.

**Итог:** ваши часы тикали со скоростью суммы времени обоих игроков, ошибка накапливалась каждый ход. Быстрый игрок проигрывал на времени задолго до реального, причём проигрывал не тот. Побочно: при передаче очереди с уже истёкшими часами **сразу срабатывал ложный таймаут**.

**Исправление:**
```ts
useEffect(() => {
  if (!isActive) return
  lastTickRef.current = Date.now()   // ← добавлено
  const interval = setInterval(...)
```

#### P0 — ходы соперника шли без звука и ломали лимит реакций

**`src/hooks/useGameSync.ts:620, 637, 315-319`**

`lastPgnRef.current = newPgn` и `pgn: newPgn` — одно и то же значение. Эхо-снапшот своего хода удовлетворяет `newData.pgn === lastPgnRef.current`, поэтому ветка классики (`:301`) не выполнялась, а `localMoveRef.current = false` (`:319`) живёт именно внутри неё. Флаг навсегда оставался `true`, и на ходе соперника условие `!localMoveRef.current` было ложно → пропускались `soundManager.play('move')` и `resetMoveCounter()`.

**Итог:** ни один ход соперника не озвучивался; `resetMoveCounter()` не сбрасывал счётчик, поэтому соперник упирался в `MAX_REACTIONS_PER_MOVE = 5` до конца партии.

**Исправление:** флаг снимается сразу после успешной транзакции, а не полагается на эхо-снапшот. Заодно добавлена обработка `txnResult === 'error'` (раньше `makeMove` возвращал `true` при незаписанном ходе):

```ts
if (txnResult === 'error') {
  localMoveRef.current = false
  /* …откат к prevPgn + тост… */
  return false
}

// Clear the flag here rather than relying on the echo snapshot: the
// PGN we just wrote is byte-identical to lastPgnRef.current, so the
// snapshot branch is never entered and the flag stayed true forever —
// which silenced every opponent move and skipped resetMoveCounter().
localMoveRef.current = false
```

#### P0 — рапид по вызову шёл без часов

`OnlineHubPage.tsx:114-131` и `LobbyPage.tsx:73-90` не писали `time_control` / `*_time_left` / `timer_status`. `useGameTimer.ts:14` выходит сразу → таймеры не рендерятся, `buildTimerUpdate` возвращает `null`. Плитка обещает «контроль времени», партия идёт без него.

**Исправление:** создан общий хелпер **`src/lib/gameDoc.ts`** с `buildTimerFields(mode, preset)`, который пишет `time_control` в **секундах**, а счётчики — в **миллисекундах** (`base * 1000`), и паркует часы в `paused` с `last_timer_update: null`. Подключён в оба файла, поэтому третья копия логики не создана. Дубль логики приёма вызова остался (это отдельный пункт аудита).

#### P1 — часы предыдущей рапид-комнаты протекали в классику

**Классика часов не имеет по задумке**, и это поведение сохранено: её документы пишут `time_control: null` (`ColorPickerModal.tsx:141-143` и `buildTimerFields` в `src/lib/gameDoc.ts`), а `GamePage.tsx:507,752` рендерят таймеры только под `{timeControl && …}`.

**Но был баг, из-за которого в классике часы всё-таки появлялись.**

Цепочка:
1. `useGameTimer.ts:14` — `setTimerFromSnapshot` выходит сразу на `if (!newData.time_control) return`, поэтому **для классики состояние часов предыдущей комнаты сохраняется целиком**
2. у `useGameTimer` **не было функции сброса**
3. эффект сброса комнаты в `useGameSync.ts` (строка 383) таймеры не трогал

`GamePage` **не перемонтируется** при смене только параметра `/game/:roomId` — а это ровно то, что делают реванш и приём вызова изнутри партии. Сценарий: сыграл рапид → принял реванш в классику → **в партии без контроля времени видны и тикают часы предыдущей игры**.

**Исправление:**

- добавлена `resetTimer()` в `src/hooks/useGameTimer.ts`, обнуляющая все пять полей
- вызывается из эффекта сброса комнаты; заодно там же сбрасываются `playerColor`, `gameMode`, `opponentName` — они тоже протекали из прошлой комнаты

```ts
setPlayerColor(null)
setGameMode('classic')
setOpponentName('')
// Classic is untimed, and setTimerFromSnapshot early-returns on a document
// without time_control — so without an explicit reset a rapid room's clock
// would keep rendering in the next classic room.
timer.resetTimer()
```

#### P1 — победа по времени выглядела как поражение

**`useGameSync.ts:163, 190-237`**

`setWinnerColor(null)` на строке 163, а ветки эмоций существовали только для `resign`, `checkmate`, `king_capture`, `draw|stalemate`. Ветки `timeout` **не было** → `winnerColor` оставался `null`.

**Итог:** `GamePage.tsx:628` `gameOverGray = … && playerColor !== winnerColor` → для победителя `'w' !== null` → **его доска обесцвечивалась как при поражении**; `GamePage.tsx:606` `playerColor === winnerColor` → ложь → **конфетти не показывались**.

**Исправление:** добавлена ветка `timeout`, выставляющая `winnerColor` и эмоции. Иконки `time.png` в проекте нет, поэтому для проигравшего используется существующая `surrender.png` (иначе была бы битая картинка).

#### P1 — пат показывался как «Игра окончена»

**`useGameSync.ts:659`** пишет `message: 'stalemate'`, но `parseResult` (`:95-113`) этот случай не знал → падение в `:111` → «Игра окончена». Текст не содержит «Ничья», поэтому `gameOverGray` срабатывал → **обе доски серые как при поражении**, при этом строка статуса показывала «Ничья».

**Исправление:** `(data.message === 'draw' || data.message === 'stalemate') ? 'Ничья'`.

---

### 2.11 Реванш: гибридный вызов

Требование: реванш доступен для классики и рапида; при нажатии бросается вызов сопернику из той же партии; вызов только в тот режим, из которого брошен (для рапида — с теми же настройками времени); для обоих режимов — смена стороны.

#### Что было

| Требование | Состояние |
|---|---|
| доступен для классики и рапида | ✅ кнопка рендерится при `gameOver` без ограничения по режиму |
| тот же режим и те же настройки времени | ⚠️ режим и `time_control` копировались верно, но часы стартовали **сразу при создании документа** (`last_timer_update: Date.now()`, `timer_status: 'active'`) вместо парковки, как в `ColorPickerModal` |
| смена стороны | ✅ `white_player_id: data.black_player_id`, `black_player_id: data.white_player_id` |
| бросить вызов сопернику | ❌ **не выполнялось** |

#### Почему «вызов» не выполнялся

Предложение реванша было флагом `rematch_proposed_by` в законченном документе партии. Он читался только в `useGameSync.ts:360` внутри `processSnapshotData`, а та вызывается из подписки, привязанной к странице конкретной игры.

**Соперник, ушедший в лобби, предложение не видел никогда.** У настоящего вызова подписка на коллекцию `challenges` есть из лобби, и есть срок жизни. У флага не было ни того, ни другого.

Дополнительно: `room_code` генерировался как `Math.random().toString(36).substring(2, 8)` — другой алфавит, чем в `ColorPickerModal`, и **без проверки уникальности**.

#### Что сделано — гибрид

**Флаг остался** (кнопка «Реванш» работает мгновенно), **плюс зеркало** в коллекцию `challenges`, поэтому предложение видно из лобби.

**`src/types/index.ts`** — `ChallengeKind = 'challenge' | 'rematch'`, поля `kind`, `sourceGameId`, `timeControl`. Мёртвое `rematch_request` удалено: его объявлял тип, но никто не писал и не читал; реализация использовала `rematch_proposed_by` / `rematch_game_id`.

**`src/lib/gameDoc.ts`** — `buildRematchGameData(original, roomCode)`, чистая функция, **единственное место** где живёт договор реванша:

- тот же `game_mode`
- тот же `time_control` дословно; классика остаётся без часов
- стороны меняются: бывший чёрный становится белым
- часы паркуются: `last_timer_update: null`, `timer_status: 'paused'`
- `control` берётся только для `rapid` — мусинг в режиме без часов не создаёт фантомных часов

**`src/lib/challenges.ts`** — общий приём вызовов обоих видов:

- `createRematchInTransaction` — создание реванша внутри транзакции; `rematch_game_id` на исходном документе это **единственный источник истины** о том, что реванш уже создан
- `acceptIncomingChallenge` — общий приём; для реванша читает исходную партию и собирает документ через `buildRematchGameData`, для обычного вызова принимающий играет чёрными
- оба пути **идемпотентны**: нажатие «Принять реванш» и принятие зеркального вызова переиспользуют одну и ту же партию, а не создают две
- обычный вызов разбирает гонку: если статус уже не `pending`, используется существующий `gameId`

**`src/hooks/useRematch.ts`** — при предложении (первый клик) зеркалит документ в `challenges` с `kind: 'rematch'`, `sourceGameId`, `mode`, `timeControl` и **TTL 10 минут** вместо 60 секунд: игрок может ждать ответа, а результат партии висит на экране дольше минуты. Зеркаление best-effort — кнопка работает и без него. При принятии создание идёт через общий хелпер.

**`src/hooks/useChallenges.ts`** — `sendChallenge` принимает `timeControl`; `acceptChallenge(challenge)` возвращает `AcceptResult` вместо прежнего `updateDoc`, который просто помечал статус без создания партии.

**`LobbyPage.tsx` / `OnlineHubPage.tsx`** — побайтово идентичный инлайн приёма (34 строки в каждом, создание игры + `updateDoc` двумя нетранзакционными записи) заменён на вызов общего хелпера. Это заодно чинит: двойной клик создавал две партии, а сбой второй записи оставлял осиротевший документ.

**Модалка** различает виды вызовов: «Приглашение на реванш» с формулировкой «Предлагает реванш в режиме „…"» и показывает контроль времени, против «Новый вызов!».

**`ColorPickerModal.tsx`** — инлайновые часовые поля заменены на `buildTimerFields`, устранён ещё один дубль. Локальный `generateRoomCode` удалён в пользу общего.

#### Тесты

`src/lib/__tests__/rematch.test.ts` — 14 тестов на договор: смена сторон, независимость результата от того, кто предложил, копирование времени с пересчётом в мс, парковка часов, классика без часов, очистка транзиентного состояния, различение видов вызова включая legacy-документы без `kind`.

Проверено откатом, что тесты ловят нарушения договора: при неверном назначении сторон и запущенных часах упали три теста.

#### Что осталось

- Принятие вызова из лобби всё ещё **не дублируется защитой от двойного клика** на кнопке — защита теперь на уровне транзакции (повторный клик переиспользует `gameId` вместо создания второй партии), но визуального `disabled` на кнопке нет
- `useChallenges` не сбрасывает `outgoingGameId` в `null` — вернувшийся в лобби в течение TTL будет принудительно перенаправлен в уже начатую партию
- Срок жизни предложения реванша (10 мин) не отображается в UI и не тикает — по истечении он просто исчезнет из списка

---

### 2.12 CI/CD и GitHub Pages

#### Что было

- каталога `.github/` **не существовало** вообще
- `firebase.json` содержал **только** секцию `firestore` — секции `hosting` не было, поэтому `firebase deploy` физически не мог задеплоить фронтенд
- в `package.json` не было скрипта `deploy`; `firebase-tools` стоял в devDependencies, но не вызывался
- `homepage` указывает на `ratpoisen-cloud.github.io/gochess` — хостинг это **GitHub Pages**, а не Firebase Hosting
- документация вводила в заблуждение: `GEMINI.md:10` обещал «авто-деплой на Firebase Hosting», `README.md:110` ссылался на несуществующий `Deploy.yml`, `AGENTS.md:153` числил CI критическим багом

#### Что сделано

**`.github/workflows/deploy.yml`** — три job-а:

| Job | Назначение | Запускается |
|---|---|---|
| `verify` | `npm ci` → `tsc --noEmit` → быстрые тесты → сборка → проверка подстановки в `404.html`/`sw.js` | всегда |
| `deploy` | публикация в GitHub Pages через `configure-pages` / `upload-pages-artifact` / `deploy-pages` | после успешного `verify` |
| `deploy-firestore-indexes` | `firebase deploy --only firestore:indexes` | **только вручную** (`workflow_dispatch`) |

Ключевые решения:
- **`VITE_BASE: /gochess/`** в env сборки — заставляет собираться под тем же base, что и продакшен, и немедленно выявляет хардкод пути в выходных файлах
- **мёртвые `VITE_FIREBASE_*`** — Firebase SDK читает их на импорте, поэтому для сборки достаточно заглушек. **Настоящие ключи в workflow не попадают никогда**
- **perft намеренно исключён** из быстрых тестов (ему нужны минуты); для него есть отдельный `npm run test:perft`
- добавлена проверка, что `__GOCHESS_VERSION__` и `__GOCHESS_BASE__` действительно подставлены, иначе подстановка молча сломалась бы
- артефакт `dist` передаётся из `verify` в `deploy`, чтобы не собирать дважды
- правила Firestore **не деплоятся** — они оставлены без изменений сознательно

**`package.json`** — новые скрипты:

```json
"typecheck": "tsc --noEmit",
"test:fast": "vitest run src/hooks/__tests__ src/stores/__tests__ src/lib/__tests__ src/components/board/__tests__",
"test:perft": "vitest run src/lib/engine/__tests__/perft.test.ts",
"verify": "npm run typecheck && npm run test:fast"
```

#### Что требует ручной настройки в GitHub

Файл workflow создан, но **пока не задеплоен**. Нужно один раз в репозитории:

1. **Settings → Pages → Source: GitHub Actions** (не «Deploy from a branch»)
2. Секрет `FIREBASE_PROJECT_ID` и `FIREBASE_DEPLOY_TOKEN` — нужны только для ручного деплоя индексов

#### Внимание: `dist/` в `.gitignore`

Файл `.gitignore` создан мной в этой сессии — **до него его не существовало**. Если действующий деплой шёл через коммит `dist/` в ветку, моя строка `dist/` этому помешает. Проверить на машине с репозиторием:

```bash
git ls-files dist/ | head
```

Непустой вывод означает, что `dist/` отслеживается git и его нужно убрать из `.gitignore`. Уже отслеживаемые файлы из-под `.gitignore` не исчезают, так что само по себе это безопасно — помешает только добавление новых файлов сборки.

---

### 2.13 Аудит магических шахмат: онлайн и оффлайн разошлись до разных продуктов

Проверено лично, каждая находка — по конкретным строкам. Онлайн считается базовым продуктом, оффлайн должен из него выводиться.

#### Масштаб расхождения

| Слой | Онлайн | Оффлайн |
|---|---|---|
| Страница | `GamePage.tsx` 1058 | `SpellLocalPage.tsx` 624 |
| Состояние | `useGameSync.ts` 1008 (Firestore) | `spellGameStore.ts` 241 (zustand) |
| Движок | `spellChessEngine.ts` 967 — **общий** | тот же |
| Инвентарь | `SpellBar` + `SpellTile` + `SpellInfoPanel` | инлайновый, 117 строк в странице |

Итого **2307 строк онлайн-кода против 865 оффлайн** на одну механику. Общими остались только `spellChessEngine.ts` и `ChessBoard.tsx`. По всему проекту — 5 игровых страниц и **4 разных способа хранить состояние движка**.

#### 🔴 M-1. Мины не видны, взрыв не проигрывается онлайн

Поле `bombs` движок **никогда не заполняет** — только инициализирует `{}` (`spellChessEngine.ts:104,129`), копирует (`:782,874,955`) и читает-удаляет при ходе на клетку (`:512-514`). Реальное поле — `pendingBlastMine` (`:598`).

- Онлайн `GamePage.tsx:372-375` читает **только** `bombs` → `activeBombs` всегда `[]`, а эффект взрыва (`:353-365`) **не срабатывает никогда**.
- Оффлайн `SpellLocalPage.tsx:92-96` читает оба поля и работает.

Итог: мина, поставленная онлайн, невидима и взрывается молча. Правка на 6 строк.

**Смежная находка (требует решения владельца).** `spellChessEngine.ts:511-514` содержит проверку «наступил на мину», которая читает `bombs` — то есть **никогда не срабатывает**. Реально работает только ветка `completeTurn()` (`:425-427, :523-525`): мина взрывается **в начале следующего хода поставившего**, а не когда на неё наступили. Комментарий в `castBlast` (`:597`) это подтверждает: «explode at start of player's next turn». Но маркер на доске читается как «наступи, чтобы взорвать». Либо маркер вводит в заблуждение, либо механика «наступи» была задумана и потерялась. **Семантику не менял** — это правила игры, решать вам.

Починено: единый список мин в `src/lib/spellMines.ts` (`activeMineSquares` + `detonatedMineSquares`), 12 тестов в `src/lib/__tests__/spellMines.test.ts`, включая проверку, что движок действительно не пишет `bombs`.

#### 🔴 M-2. Шах и мат не определяются вообще

`spellChessEngine.ts:906-912` жёстко возвращает `false` из `inCheck()`, `isCheckmate()`, `isStalemate()`, `isDraw()`, `isInsufficientMaterial()`. Следствия онлайн: подсветки шаха нет, блок статуса `GamePage.tsx:589-598` мёртв, ничья через движок недостижима. `SpellChessEngine` **не расширяет** `PoisenChess` (в отличие от `AtomicChessEngine`), поэтому методы пришлось заглушить.

При реализации важно: взятие короля в Spell Chess само по себе конец партии, поэтому `isCheckmate` нельзя копировать из `PoisenChess` — это разные события.

#### 🟡 M-3. PGN битый, последний ход не подсвечивается онлайн

Движок в spell-режиме пересоздаётся из FEN каждый полуход (`useGameSync.ts:266,288,572`) → `moveStack` пуст. Отсюда:
- `pgn: g.pgn()` (`useGameSync.ts:599,892`) отдаёт один полуход или `''`;
- `setLastMove(null)` (`useGameSync.ts:126`) — `history()` пуст, подсветка последнего хода пропадает.

Чинить без перестройки движка: клиент, сделавший ход, пишет `last_move: { from, to }` и дописывает свой SAN (из `Move`) в накопитель PGN.

#### 🟡 M-4. Онлайн не валидирует цель `shadowGrave` и `mirage`

`spellGameStore.ts:100-103,110-114` проверяет «своя фигура и не король» и молча игнорирует. В `GamePage.tsx:239-249` проверок нет — попытка даёт тост «Заклинание невозможно применить» (`:193`). Логика есть в оффлайне, переносится вверх.

#### 🟢 M-5. Панель заклинаний соперника показывает ложное состояние

`GamePage.tsx:622-623` жёстко `isMyTurn={false} hasCastSpellThisTurn={false}` — потраченные свободные заклинания соперника не отображаются.

#### 🔴 Оффлайн: 7 подтверждённых багов

1. **Все иконки заклинаний битые.** `SpellLocalPage.tsx:528,597` строит `${BASE}emojis/{icon}`, реальные файлы в `public/emojis/spells/`. `SpellTile.tsx:32` использует верный путь.
2. **Нет подсветки ходов и превью.** `:410` передаёт в `ChessBoard` только `position`, без `game` → `ChessBoard.tsx:101-118` возвращает `[]` → точки ходов, кольца взятий и hover-превью не рисуются.
3. **Свободные заклинания блокируются.** `spellGameStore.ts:162` гасит все заклинания после любого каста, тогда как онлайн проверяет `hasCastSpellThisTurn && isFreeAction` (`SpellBar.tsx:75`). После «Прыжка» в этом ходу недоступны заморозка, взрыв, берсерк, милость, тень, мираж.
4. **Берсерк превращает в пешку.** `:435` → `['q','r','b','n','p']` против `GamePage.tsx:701` → `['q','r','b','n']`.
5. **Нет превращения пешки** вообще — единственная игровая страница без него.
6. **Тернарник без null-ветки.** `:326` — при ничьей (`winner === null`) выведет «Победа чёрных!».
7. **Подсветка шаха дублирует онлайновую логику** вручную (`:47-51`).

#### Что есть в оффлайне, но отсутствует онлайн

Маркер мины (починится в M-1), превью области `divineGrace` (`:239-255`), превью цели щита (`GamePage.tsx:422-424`), VFX заморозки и прыжка при попытке сдвинуть фигуру (`:164-172`). Это поднимается вверх, а не выбрасывается.

#### Срамёльный код — группы к выносу

| Дубликат | Копии | Строки |
|---|---|---|
| Метаданные 9 заклинаний | 3 | `SpellTile:21-31`, `SpellInfoPanel:4-50`, `SpellLocalPage:18-28` |
| Списки и флаги заклинаний | 4 | `SpellBar:35-37`, `SpellLocalPage:30-33`, `spellChessEngine:411-412`, `GamePage:230` |
| Диспетчер выбора цели | 3 | `GamePage:226-269`, `SpellLocalPage:177-195`, `spellGameStore:86-129` |
| Копирование `SpellState` | 3 | `copySpellState`, `deepCloneSpellState:774`, `applySpellStateJSON:940` |
| `customSquareStyles` | 2 (98 и 124 строк, ~50 совпадают посимвольно) | `GamePage:390-487`, `SpellLocalPage:200-323` |
| Карта «заклинание → VFX» | 2 | `GamePage:196-221`, `SpellLocalPage:126-153` |
| `checkPromotion` | 3 | `GamePage:156`, `LocalPage:143`, `AtomicLocalPage:100` |
| `onDrop` | 4 | по одной на страницу |
| `getSquareCenter` | 5 | по одной на страницу |
| Пикер превращения | 2 | инлайн в `GamePage` + общий `PromotionPicker`, который онлайн игнорирует |

Расхождения в цветах одного эффекта: `portalStart` — `rgba(150,50,255,0.25)` (`GamePage:427`) против `rgba(160,32,240,0.4)` (`SpellLocalPage:292`). Тексты: «Магический Щит» против «Щит».

#### Главная причина, почему это не отлавливалось

**Тестов на `GamePage.tsx` и `SpellLocalPage.tsx` нет ни одного.** Покрыты движок и хуки. Страницы — единственное непроверяемое звено.

#### Что НЕ является багом

`buildTimerUpdate` вызывается только для классики (`useGameSync.ts:721`), но контроль времени есть **только в режиме rapid** (`useRematch.ts:147`, `gameDoc.ts:55` — `time_control: null`). У spell-часов и не должно быть. Ошибка в моей первой гипотезе.

---

## 3. Новые тесты

**Файлы:**
- `src/lib/__tests__/spellPly.test.ts` — 9 тестов, **23–380 мс**
- `src/components/board/__tests__/ChessTimer.test.tsx` — 5 тестов, **~140 мс**
- `src/hooks/__tests__/roomClockReset.test.ts` — 3 теста, **~44 мс**

| Тест | Что проверяет |
|---|---|
| advances halfMoveCount and reports a rising turn number | базовый рост счётчика |
| emits a real fullmove number in FEN and derives it back on load | `fen()` → `load()` round-trip |
| keeps the ply counter through spell_state_json (the online path) | восстановление через SSJ |
| preserves the ply counter for a legacy document with no halfMoveCount | фолбэк для старых документов |
| unlocks spells as the turn number crosses their threshold | пороги 7 и 31 |
| **unlocks spells across 40 online rebuild cycles** | **ключевой: симулирует `useGameSync`** |
| charges survive a partial spell_state_json instead of zeroing out | защита зарядов |
| does not emit bogus castling rights in FEN | поле рокировки `-` |
| undo restores the previous ply count | `undo()` |
| **does not subtract the opponent thinking time when the turn comes back** | **ключевой для таймера** |
| accumulates correctly over several move pairs | накопление ошибки за 3 цикла ходов |
| still counts down our own clock once running | базовая работа |
| fires onTimeout exactly once when the clock expires | без дубля срабатывания |
| does not fire onTimeout while it is not our turn | отсутствие ложного таймаута |

Ключевой тест воспроизводит точный цикл онлайна: ход → `fen()` → `spellStateToJSON()` → `new SpellChessEngine(fen)` → `applySpellStateJSON()`. Ходы выбирает сам движок через `getLegalMoves`, поэтому легальность гарантирована (первая версия теста использовала захардкоженную последовательность и падала на 6-м полуходе — ошибка была в тесте, не в движке).

### Тесты не пустые — каждый эшелон проверен откатом

| Что откатывалось | Что упало |
|---|---|
| `fen()` → `const fullmove = 1` | `emits a real fullmove number…` → `expected '1' to be '2'` |
| удаление фолбэка `halfMoveCount` из `applySpellStateJSON` | `preserves the ply counter for a legacy document…` → `expected undefined to be 3` |
| удаление `lastTickRef.current = Date.now()` из эффекта по `isActive` | `does not subtract the opponent thinking time…` → **потеря 46 000 мс вместо ≤2 000**; `accumulates correctly…` → `expected 554000 to be 594000`; `does not fire onTimeout while it is not our turn` → **ложный таймаут при передаче очереди** |

Вывод: основной фикс онлайн-пути — **поле в `SpellState`** (разносится спредом `...parsed`); правка `fen()` — второй эшелон, нужный для путей, несущих только FEN (`useGameRequest` при откате, legacy-документы).

---

## 4. Аудит: оставшиеся находки и решения

Всё ниже **не исправлено**. Отсортировано по влиянию на пользователя.

---

### 🔴 P0-1. `useRoomJoin` — можно сесть в комнату без кресла и вмешаться в чужую игру

**`src/hooks/useRoomJoin.ts:52-85`**

Ветка выбирается по данным **до** транзакции (строки 52, 64, 76), а guard внутри смотрит **свежие** данные (строки 57, 69). При проигранной гонке тело транзакции просто `return` — **оно не сообщает об отказе**, и `onJoined(gameDoc.id)` выполняется безусловно на строке 85.

Воспроизведение: двое открывают одну ссылку одновременно. Один получает кресло, второй — нет, без ошибки, с `playerColor === null` и мёртвой доской. Хуже: этот игрок всё равно достаёт модалки отмены хода и ничьей (`GamePage.tsx:942-956`, гейт только `from_id !== user.uid`) и может принять ничью либо переписать `fen`/`pgn` в чужой партии.

**Решение:** транзакция должна возвращать результат `'claimed' | 'taken'`, и проигравший должен уходить в `onError('Комната уже заполнена')`:

```ts
const result = await runTransaction(db, async (transaction) => {
  const snap = await transaction.get(ref)
  const data = snap.data()
  if (!data) return 'missing'
  if (data.white_player_id === user.uid || data.black_player_id === user.uid) return 'mine'
  if (targetFieldIsFree(data)) {
    transaction.update(ref, { [targetField]: user.uid, /* … */ })
    return 'claimed'
  }
  return 'taken'
})
if (result === 'taken') { onError('Комната уже заполнена'); return }
```

---

### 🔴 P0-2. Принятие отмены хода без валидации

**`src/hooks/useGameRequest.ts:18-66`**

Три независимые проблемы:

1. **Нет проверок.** Единственная проверка — `if (!gameDocId || !undoRequest) return`. Нет проверки `turn`, `game_state`, и не истёк ли запрос. `undoRequest` не перечитывается внутри транзакции (строки 59-61 проверяют только `exists()`), поэтому отклонённый или истёкший запрос всё равно можно принять — в том числе **после `game_state === 'game_over'`**. Баннер продолжает показывать «Шах победил», а позиция молча откатывается на 1–2 полухода.
2. **Затирание чужого хода.** `getDoc` на строке 21 используется только для вычисления `requestorColor`. А `fen`/`pgn`/`turn` берутся из аргумента `pgn` (`useGameSync.ts:883` → `lastPgnRef.current`, локальное зеркало), и `updateFields` считается **до** транзакции и пишется вслепую. Любой ход, успевший упасть между чтением и записью, **уничтожается**. Сравните с `makeMove`, где guard есть (`useGameSync.ts:670`).
3. **Мина для spell-режима.** `g.loadPgn(pgn)` — **молчаливый no-op** для Spell Chess (`spellChessEngine.ts:868`), и `catch`-фолбэк на строках 32-34 **не срабатывает**. Если этот путь когда-нибудь будет достигнут, он запишет `fen` = стартовая позиция и `pgn` = `''`, то есть **полное обнуление партии**. Сейчас недостижимо, потому что кнопка «Отмена» скрыта в spell-режиме (`GamePage.tsx:875`), но хук этому не препятствует. В atomic-режиме теряется atomic-состояние, так как `applySpellStateJSON` у `AtomicChessEngine` не существует.
**Решение:** перенести вычисление `updateFields` **внутрь** транзакции, читать позицию из транзакционного документа, а не из аргумента; добавить guards:

```ts
return runTransaction(db, async (transaction) => {
  const snap = await transaction.get(ref)
  const fresh = snap.data()
  if (!fresh) return 'missing'
  if (fresh.game_state === 'game_over') return 'finished'
  if (!fresh.undo_request || fresh.undo_request.token !== undoRequest.token) return 'stale'
  // пересчёт fen/pgn от позиции ИЗ ЭТОГО чтения
  const target = createEngine(mode, fresh.fen)
  if (isSpell) (target as any).applySpellStateJSON?.(fresh.spell_state_json)
  else target.loadPgn(fresh.pgn)
  // откатить 1 или 2 полухода согласно requestorColor
  transaction.update(ref, { fen: target.fen(), pgn: target.pgn(), turn: target.turn(), /* … */ })
  return 'ok'
})
```

Для spell-режима нужно либо реализовать `loadPgn` в движке, либо хранить в документе список полуходов и пересобирать состояние из него.

---

### 🔴 P0-3. «Принять ничью» перезаписывает завершённую партию

**`src/hooks/useGameRequest.ts:77-94`**

Поля, которые пишутся, внутренне согласованы (`game_state: 'game_over'`, `winner: null`, `message: 'draw'`), но **нет повторной проверки `game_state === 'game_over'`** внутри транзакции.

Воспроизведение: предлагаю ничью → соперник ставит мат → баннер показывает мат → модалка ничьей всё ещё открыта (`GamePage.tsx:950` **не** защищён `!gameOver`) → жму «Принять» → мой выигрыш перезаписан на ничью **у обоих игроков**. Также остаётся висеть `undo_request`.

**Решение:**

```ts
if (fresh.game_state === 'game_over') return 'finished'
if (!fresh.draw_request) return 'stale'
```

и дополнительно скрывать/блокировать модалки при `gameOver` в `GamePage.tsx:950`.

---

### 🔴 P0-4. Перезагрузка стирает PGN партии с ботом и открывает её на пустой доске

**`src/stores/gameStore.ts:377-395`**

Персистится только FEN, движок пересоздаётся без истории → `pgn()` возвращает одни заголовки, `history()` возвращает `[]`.

Два триггера:
- **Завершённая партия:** `BotPage.tsx:39-45` → `useEndGameEffects.ts:26-28` срабатывает на первом же проходе эффекта, потому что `savedRef` (`useEndGameEffects.ts:23`) — неперсистентный ref и при монтировании всегда `false`, а `isGameOver: true` восстановлен из localStorage → `saveGame` перезаписывает документ пустым PGN
- **Партия в процессе:** `BotPage.tsx:59-63` срабатывает после гидратации → `updateBotGameDoc` (`gameStore.ts:245-250`) стирает PGN документа

**Видимый симптом:** `loadBotGameFromFirestore` (`gameStore.ts:268-274`) **предпочитает** `data.pgn`, если он truthy, — а `pgn()` всегда возвращает минимум 7 строк заголовков, то есть **всегда** truthy. `loadPgn` парсит 0 токенов → партия открывается на **пустой стартовой доске**, а реальный `data.fen` игнорируется. Пользователь нажимает на партию в лобби — «сбросилась на первый ход».

Также «Копировать PGN» в `BotPage.tsx:38` после перезагрузки копирует только заголовки.

**Решение:** восстанавливать движок из персистентного PGN. В `storage.getItem` сохранять `pgn` и пересобирать через `loadPgn(pgn)` с фолбэком на `createEngine(fen)`:

```ts
const engine = (data.pgn && persisted.pgn)
  ? (() => { const e = createEngine(); try { e.loadPgn(data.pgn); return e } catch { return createEngine(fen) } })()
  : createEngine(fen)
```

Второе: сделать `savedRef` персистентным маркером «уже сохранено» (например, сохранённый FEN или id документа в сторе), иначе `useEndGameEffects` пересохранит партию на каждом монтировании.

---

### 🟠 P0-5. Реакция остаётся на экране навсегда

**`src/pages/GamePage.tsx:279-311`**

Локальный стор меняется на строке 290, пикер закрывается на 296-297 — и только **потом**, на строке 300, выполняется `await runTransaction`. При исключении (строка 308) отката нет: реакция остаётся в UI и в Zustand навсегда, до Firestore не доходит. Расхождение локального и удалённого состояния необратимо.

**Решение:** сначала дождаться транзакции, и только потом обновлять локальный стор и закрывать пикер:

```ts
try {
  await runTransaction(db, async (transaction) => { /* … */ })
  useReactionStore.getState().addReaction(r, playerColor)
  setPickerSquare(null)
} catch {
  addToast('Не удалось отправить реакцию', 'error')
}
```

---

### 🟠 P0-6. Утечка состояния выбора заклинания

**`src/pages/GamePage.tsx:500`**

Сброс `activeSpell` **не трогает** `portalStart` (строка 52), `mirageStart` (53), `pendingTarget` (55), `berserkTarget` (56), `selectedSquare` (38), `legalMoves` (39). Эффекта, сбрасывающего `pendingTarget` при смене `activeSpell`, в файле нет — **в `SpellLocalPage.tsx:77-79` такой guard есть, а в `GamePage` отсутствует**.

Воспроизведение: выбрать `portal` → кликнуть `e4` (`portalStart='e4'`) → кликнуть на шахматные часы (строка 502-510, внутри `game-main-column`, но вне `board-container:599` со `stopPropagation`) → `activeSpell` сброшен, `portalStart` сохранился → снова выбрать `portal` → **следующий клик по доске мгновенно кастует портал**. Аналогично для `mirageStart` (203) и `pendingTarget` (232-233).

Также `onSquareClick:185` имеет `if (gameOver || !isMyTurn) return`, но эти состояния **не очищаются**. `SpellBar` блокирует все тайлы (`canCast`), но `activeSpell` остаётся подсвеченным, баннер «Целься заклинанием…» (543-547) остаётся, и на следующем ходе устаревший `pendingTarget` в одном клике от выстрела. Оверлей `berserkTarget` (661-715) защищён только `berserkTarget && stableWidth` — переживает смену хода и конец партии, а его кнопки вызывают `castSpell`, возвращающий `false` на `useGameSync.ts:737`. **Залипающий оверлей.**

**Решение:** единая функция сброса + эффект на смену выбора/хода/конца партии:

```ts
const clearSpellSelection = useCallback(() => {
  setActiveSpell(null)
  setPendingTarget(null)
  setPortalStart(null)
  setMirageStart(null)
  setBerserkTarget(null)
  setSelectedSquare(null)
  setLegalMoves([])
}, [])

useEffect(() => {
  if (!activeSpell || !isMyTurn || gameOver) clearSpellSelection()
}, [activeSpell, isMyTurn, gameOver, clearSpellSelection])
```

---

### 🟠 P0-7. Пикер превращения без выхода + потерянный `promotion`

**`src/pages/GamePage.tsx:630-651`**

Оверлей `<div className="absolute inset-0 z-[100] bg-black/20 …">` **не имеет** `onClick`, `onCancel`, ни слушателя Escape (в файле нет ни одного `keydown`). Единственный выход — 4 кнопки. Сравните с `src/components/PromotionPicker.tsx:23`, где есть `onClick={onCancel}` — **это строгая регрессия вынесенного компонента**.

В spell-режиме все 4 кнопки делают одно и то же: `makeMove(from, to, piece)` → `useGameSync.ts:521` вызывает `(g as any).move(from, to)` и **выбрасывает** аргумент `promotion`. Поскольку в движке нет превращения, пешка остаётся пешкой.

Более того, в `spellChessEngine.ts:257-286` (генерация ходов пешки) нет ветки на 8-ю горизонталь, а `move()` никогда не меняет `piece.type`. Белая пешка на `a8` использует `dir = -1`, поэтому `r + dir` выходит за доску → **ноль легальных ходов навсегда**.

Дополнительно: `selectedSquare` и `legalMoves` не очищаются ни на пути превращения (строка 249), ни на обычном (252), поэтому точки легальных ходов остаются видимыми после хода.

**Решение (две части):**

1. Заменить инлайн-оверлей на существующий компонент:
```tsx
{pendingPromotion && (
  <PromotionPicker
    to={pendingPromotion.to}
    color={playerColor}
    onSelect={(piece) => { makeMove(pendingPromotion.from, pendingPromotion.to, piece); setPendingPromotion(null) }}
    onCancel={() => setPendingPromotion(null)}
  />
)}
```
2. Привести `SpellChessEngine.move()` к контракту `EngineAPI` и реализовать преврашение:
```ts
move(m: { from: string; to: string; promotion?: string }): Move | null {
  // …
  const target = to[1] === '8' || to[1] === '1'
  const promoType = target ? (promotion || 'q') : undefined
  // в move(): this._pieces[tr][tc] = { type: promoType, color }
}
```
Тогда `useGameSync.ts:521` станет `g.move({ from, to, promotion })` и `as any` в этой строке исчезнет.

---

### 🟡 P1-8. Результат `castSpell` нигде не проверяется

**`src/pages/GamePage.tsx:181`**

`castSpell?.(spell, target, target2)` отбрасывает `Promise<boolean>`. Любой отказ движка (`useGameSync.ts:518, 539, 579, 612, 654, 764`) — **молчаливый no-op**: нет тоста, нет ошибки, а `activeSpell`/`portalStart`/`mirageStart` уже очищены.

Плюс `blast` внесён в `noConfirmSpells` (строка 188), хотя он терминальный (`spellChessEngine.ts:24`): один промах по любой клетке мгновенно тратит ход и заряд, `castBlast:564-573` ничего не валидирует.

`shadowGrave` проигрывает VFX до валидации в движке: `GamePage.tsx:175-178` показывает взрыв до того, как `spellChessEngine.ts:612` решает, было ли заклинание.

**Решение:**
```ts
const ok = await castSpell?.(spell, target, target2)
if (!ok) { addToast('Заклинание невозможно применить', 'error'); return }
```
Плюс перенести `blast` из `noConfirmSpells`, добавить клиентскую валидацию цели, и вызывать VFX **после** успешного каста.

---

### 🟡 P1-9. `SpellChessEngine` не реализует `EngineAPI`

**`src/lib/spellChessEngine.ts`**

Объявлен без `implements EngineAPI` и кастуется через `as unknown as EngineAPI` (`factory.ts:9`). 7 методов — заглушки:

| Строка | Метод | Поведение |
|---|---|---|
| 868 | `loadPgn` | пустое тело, `loadPgn` — no-op |
| 870 | `inCheck` | `return false` |
| 872 | `isCheckmate` | `return false` |
| 874 | `isStalemate` | `return false` |
| 876 | `isDraw` | `return false` |
| 878 | `isInsufficientMaterial` | `return false` |
| 880 | `isThreefoldRepetition` | `return false` |

**`getLegalMoves` (строка 245) НЕ фильтрует безопасность короля** — `isSquareAttacked` (строка 185) внутри движка не вызывается ни разу (единственный внешний вызов — `SpellLocalPage.tsx:50`, косметическая подсветка). Следствия: шах не фиксируется, мат невозможен, можно ходить королём под шахом. Так как `inCheck()` возвращает `false`, состояние шаха никогда не показывается.

`isGameOver()` (724) **не может вернуть `'draw'`**, потому что опирается на заглушки → `gameResult()` (886) никогда не даёт `'1/2-1/2'` → `useGameSync.updateGameState:117-123` всегда ставит `status: 'playing'`. **Игрок без легальных ходов (например, все фигуры заморожены) не может завершить партию вообще** — вечный мягкий блок.

`moveToObj` (779-793) читает неправильные фигуры: `getPiece(to)` при взятии возвращает **противника**, поэтому `move.piece` и `move.color` описывают чужую фигуру; `captured` берётся из **предыдущего** хода в `moveStack`; `flags` всегда `'-'`, из-за чего `ChessBoard.tsx:127-129` **никогда не рисует кольцо взятия** в режиме магии.

`fen()` и `load()` больше не читают castling/ep/halfmove; `load()` **не очищает** `_pieces` перед разбором (латентно, так как движок всегда создаётся заново); en passant **не реализован вовсе** (строка 285-296 генерирует только взятия занятых клеток).

**Решение (по возрастанию трудоёмкости):**

**Шаг A — объявить `implements EngineAPI` и убрать заглушки-враньё.** Минимально: `loadPgn` должен бросать осмысленную ошибку, а не быть no-op, чтобы `catch`-фолбэки работали. Это заставит TS показать все несовпадения.

**Шаг B — реализовать шах/мат/пат.** Либо переопределить генерацию с проверкой `isSquareAttacked` после каждого хода, либо (лучше) **сделать `SpellChessEngine` подклассом `PoisenChessEngine`** с переопределением хука затронутых заклинанием клеток. Тогда шах, мат, пат, превращение и SAN достаются бесплатно, а дублирование ~40% кода движка исчезает. Это большой рефакторинг — оценивать отдельно.

**Шаг C — `flags` и `moveToObj`.** Установить реальные флаги и передавать взятую фигуру явно, а не читать из предыдущей записи стека.

---

### 🟡 P1-10. Таймер: спящего игрока невозможно зафиксировать

**`src/hooks/useGameTimer.ts`**

Фиксация флага живёт внутри `setTimerFromSnapshot` (строки 22-42), а тот вызывается **только при доставке снапшота**. Если документ не меняется, снапшот не приходит и часы никто не переоценивает. Игрок, закрывший вкладку, блокирует партию навсегда — интервала в хуке нет.

Дополнительно:
- **расхождение часов клиента = подарок времени** (строки 51-60): устройство на 5 минут спешащее записывает `last_timer_update` в будущее; у соперника `elapsed` отрицателен, и `white_time_left` **увеличивается** (нет верхней границы)
- **ход с нулевым временем всё равно применяется** (`useGameSync.ts:632-658`): `isTimeout` считается после того, как ход применён к `updateData`
- **фиксация отключена для ходящего** (`useGameTimer.ts:29` `turn !== myColor`), а партии создаются со `timer_status: 'paused'` (`ColorPickerModal.tsx:145`) — можно бесконечно стоять на старте без запуска часов
- запись инициируется **изнутри** read-колбэка `onSnapshot` без защиты от повторного входа (строки 30-39)
- `buildTimerUpdate:47-49` для первого хода не делает ни списания, ни прибавления, и чёрные фактически стартуют от хода белых
- партии, созданные через вызов (`OnlineHubPage.tsx:114-131`, `LobbyPage.tsx:73-90`), **вообще не имеют часов** — нет `time_control`/`timer_status`, `setTimerFromSnapshot` выходит на первой строке

**Решение:** добавить локальный интервал переоценки часов (раз в секунду) плюс фиксацию по `visibilitychange`/`beforeunload`; для честных часов использовать серверное время вместо `Date.now()` клиента; проверять `isTimeout` **до** применения хода.

---

### 🟡 P1-11. `useAuth` — 6 подписок и 18 записей на одно событие авторизации

**`src/hooks/useAuth.ts:48`**

```ts
const user = useAuthStore()   // ← без селектора
```

Хук подписан на любую запись в стор, включая `setLoading`. `useAuth()` вызывается в **15 местах** (10 страниц, 3 компонента, 2 хука). Одновременно живых подписок больше: `/online` монтирует `OnlineHubPage` + `UserMenu` + `usePresence` + `useChallenges` (страница) + `ColorPickerModal` + `useChallenges` (из ColorPicker) = **6**.

Одно событие авторизации → 6 вызовов `setUser` (каждый возвращает новый объект) + 12 `setLoading` = **18 записей**, каждая перерисовывает 15 потребителей. Далее `user` входит в dep-массивы `useChallenges` (строки 40, 64), `usePresence` (34) и слушателя документа партии в `useGameSync` (415, и косвенно через `processSnapshotData:360`) → на `/online` это 4 слушателя вызовов × 6 волн = **24 цикла переподписки**, и полная переподписка документа партии на игровой странице.

Результат отрисовки не ломается (переподписка идемпотентна), но это чистые накладные расходы.

**Решение:**

```ts
const user = useAuthStore(s => s.user)
const isLoading = useAuthStore(s => s.isLoading)
```

и поднять единственную подписку `onAuthStateChanged` на уровень провайдера, а не в хук. Тогда `normalizeUser` вызывается один раз на событие.

---

### 🟡 P1-12. Приём вызова — две нетранзакционные записи

**`src/hooks/useChallenges.ts`**

- `acceptChallenge` (строки 87-92) — **мёртвый код**: не деструктурируется никем (только `incomingChallenges` и `declineChallenge` в `LobbyPage.tsx:65`, `OnlineHubPage.tsx:33`). При этом он нерабочий: ставит `status: 'accepted'` без `gameId`, поэтому навигация отправителя (строки 55-60) не срабатывает
- инлайновые версии — `addDoc(games)` затем `updateDoc(challenges)` (`LobbyPage.tsx:73→92`, `OnlineHubPage.tsx:114→133`). Если вторая запись упадёт, останется **осиротевший документ партии** (видно обоим в «последних партиях»), вызов останется `pending`, а повторная попытка создаст **вторую** партию
- кнопки приёма без guard от повторного клика (`LobbyPage.tsx:420`, `OnlineHubPage.tsx:380`) → двойной клик создаёт две партии и дважды вызывает `navigate`
- истечение срока вызова вычисляется **только при доставке снапшота** (строки 28-37), запрос не ограничен по сроку, таймера обратного отсчёта в UI нет → просроченный вызов висит в списке; `handleAcceptChallenge` срок тоже не проверяет. Итог: принимающий создаёт партию и уходит в **призрачную комнату** — отправитель не придёт, потому что его собственный guard `expiresAt > Date.now()` (строка 57) не пройдёт
- `outgoingGameId` (строка 12) никогда не сбрасывается в `null` — покинувший лобби и вернувшийся в течение 60 секунд будет принудительно перенаправлен

**Решение:** удалить мёртвый `acceptChallenge`; выполнять создание партии и обновление вызова в одной транзакции; добавить guard от повторного клика; фильтровать по сроку на уровне запроса (`where('expiresAt', '>', Date.now())`) плюс таймер в UI.

---

### 🟡 P2-13. `usePresence` и лимит реакций

**`src/hooks/usePresence.ts:16-33`**
Пишет `users/{uid}` = `{uid, displayName, photoURL, lastSeen}` раз в 120 секунд. Cleanup только чистит интервал — **записи об уходе нет**, поэтому `lastSeen` устаревает до 2 минут. При этом `lastSeen` **нигде не читается** (только объявлено в `types/index.ts:15`), то есть видимого эффекта сегодня нет. Побочно: переименование себя в настройках не обновляет партии в процессе, потому что документы партий фиксируют `white_name`/`black_name` при создании.

**`src/stores/reactionStore.ts`**
- `useGameSync.ts:348` вызывает `addReaction(r)` **без аргумента `color`** → проверка `MAX_REACTIONS_PER_MOVE` (строки 38-41) пропускается, счётчики не растут. Удалённый лимит держится только на `slice(-20)` в `GamePage.tsx:305`
- `removeReaction` (56-58) **не уменьшает** счётчики
- **Реальный баг:** `LocalPage.tsx:238` передаёт `currentTurn as Color`, а `resetMoveCounter` там **не вызывается никогда** → после 5 реакций за всю сессию `addReaction` возвращает `limit_reached`, результат игнорируется, пикер закрывается, и **эмодзи перестают появляться вообще, молча**
- `square_occupied` (строка 35) — глобальный флаг, поэтому реакция на клетку, на которую соперник только что отреагировал, молча отбрасывается

**Решение:** передавать `color` из `useGameSync`; вызывать `resetMoveCounter` в локальном режиме при смене хода; уменьшать счётчики при истечении TTL; сделать проверку «занято» привязанной к последней реакции, а не к глобальному флагу.

---

### 🟡 P2-14. Бот может зависнуть навсегда

**`src/lib/botEngine.ts:64-81`**

У `getBestMove` **нет таймаута**. Промис завершается только через `worker.onmessage` или `worker.onerror`. `setIsBotThinking(false)` в `BotPage.tsx:155` **недостижим**, пока ожидание длится, а guard на строке 114 не даёт эффекту перезапуститься → UI показывает «Ход соперника» вечно, кнопки отмены нет. Упавший воркер **восстанавливается** (`catch` на строке 139), медленный — нет.

Причина медлительности: корневой цикл (`ichiBot.ts:169`) передаёт каждому корневому ходу **полное окно** `-Infinity, Infinity`, поэтому на корне нет alpha-beta, а каждый `moves({verbose: true})` очень дорог (см. раздел 5).

**Решение:** обернуть `getBestMove` в `Promise.race` с таймаутом (например, 5 с) и в обработчике таймаута брать первый легальный ход из уже сгенерированного списка; добавить `postMessage`-отмену при размонтировании. Устранить утечку промиса в `destroy()` (строки 82-93): `clearPendingRequest` лишь сбрасывает ссылки, созданный промис не завершается никогда.

---

### 🟡 P2-15. Архив открывает неправильный маршрут

**`src/pages/CompletedGamesPage.tsx:98`**

```ts
navigate(`/game/${g.id}`)   // для всех записей
```

Включая `game_type: 'bot'` и `'local'`. `LobbyPage.tsx:178-184` ветвится правильно по `game_type`. Должно быть так же, иначе архив отправляет в онлайн-комнату, которой нет.

**Решение:** переиспользовать ту же ветку, что и в `LobbyPage`.

---

### 🟢 P3-16. Прочее

| Место | Проблема | Решение |
|---|---|---|
| `App.tsx:24-38` | нет `path="*"` → любой устаревший/неизвестный URL даёт пустую страницу без выхода | добавить `NotFound`-маршрут |
| `src/lib/chessFog.ts` + `useGameSync.ts:592-597` | **Fog of War не имеет целостности**: полный FEN и PGN пишутся для всех режимов, соперник их загружает. `getVisibleSquares` — только UI-фильтр, вся армия читается из devtools | серверная фильтрация или скрытие данных; в текущей архитектуре не решаемо |
| `src/lib/spellChessEngine.ts:52-62` | `Math.random()` в `castShadowGrave` (строка 638) выбирает жертву, но выбор **не записывается** в `SpellState`. Результат восстановим из FEN, но **не** воспроизводим, и клиент, намеренно проигравший гонку (`useGameSync.ts:805-816` откатывает **после** каста), может переролить случайную жертву | записывать выбранную клетку в `SpellState` |
| `src/lib/spellChessEngine.ts:724` | `isGameOver()` может вернуть только `'white'/'black'/null`, никогда `'draw'` (опирается на заглушки) | см. P1-9 |
| `src/lib/spellChessEngine.ts:864` | `if (result !== '*') pgn = pgn.trim()` — обрезает строку, но **никогда не дописывает** `result` | дописывать или убрать |
| `useGameSync.ts:153` | `opponentJoinedRef` только записывается, никогда не читается — мёртвый код | удалить или использовать |
| `gameStore.ts:107-108` | `makeMove` принимает FEN в параметре `from` как бэкдор: `if (from.includes('/') \|\| from.includes(' ')) game.load(from)`. Из UI недостижимо; используется только тестом (`gameStore.test.ts:155`). Если сработает: `load()` обнулит историю → `moveHistory` схлопнется, undo сломается навсегда; `lastMove` сохранит FEN как `from` (`ChessBoard.tsx:181` никогда не совпадёт). Также **нет проверки очереди/владения** — `makeMove` с удовольствием двигает любую сторону, вся защита на уровне страниц | разделить на `makeMove` и `loadPosition` |
| `src/lib/engine/index.ts` | не экспортирует `AtomicChessEngine`, из-за чего `AtomicLocalPage.tsx:4` импортирует по прямому пути | дополнить barrel |
| `PoisenChess.ts:64` | `load()` не проверяет FEN: `for (const ch of rows[r])` без guard (в `SpellChessEngine.ts:134` guard есть), `parts[1] as Color` — бесконтрольный каст | валидация FEN |
| `PoisenChess.ts:625-633` | `loadPgn` сбрасывает 6 полей, затем `load(START_FEN)` перезаписывает их все — мёртвый код | упростить |
| `PoisenChess.ts:451` | `removeCastle(flag, _forColor)` — второй параметр не используется, подчёркнут для `noUnusedParameters` | убрать параметр |
| `PoisenChess.ts:730` | `halfMoveClock >= 100` — правило 50 ходов безымянно | именованная константа |
| `types.ts:16` | `Move.flags` — голый `string` с недокументированным словарём (`''`,`'b'`,`'c'`,`'e'`,`'p'`,`'pc'`,`'k'`,`'q'`). Потребители проверяют строками (`ChessBoard.tsx:124`). `SpellChessEngine` выдаёт `'-'`, не совпадающее ни с чем | union-тип `MoveFlag` |
| `src/lib/engine/PoisenChess.ts` | `_turn`, `castlingRights`, `epSquare`, часы, `_history`, `positionCount`, `_gameResult`, `kingSquare` объявлены `private`; `protected` только `_board`. Поэтому `AtomicChessEngine` дублирует поиск короля, индексную математику и пишет в приватное поле через `(this as any)` (строка 49) | сменить на `protected` — исчезнут все три дублирования |
| `src/lib/spellChessEngine.ts` | ~40% дублирования `PoisenChess`; свой `Piece`/`Move`, объявленные заново (строки 1-19) | см. P1-9, шаг B |
| `src/lib/spellChessEngine.ts` | **три** почти идентичных функции клона состояния: `deepCloneSpellState` (759), `spellGameStore.ts:6-16` (`copySpellState`), `undo()` (834) | одна функция |
| `spellChessEngine.ts:531,540,555,580,619` | длительности заклинаний — «голые» литералы без имён и комментариев (в `AGENTS.md` описаны прозой) | именованные константы |
| `console.log`/`console.error` в продакшн-путях | `gameStore.ts:232,235,252,299,340,367,370`; `botEngine.ts:35,55,88`; `BotPage.tsx:140` — нарушает правило 9 проекта; часть выводит id документов Firestore | убрать |
| Доступность | **2** атрибута `aria-*` на всё приложение, **ноль** `aria-label`. `index.css:226-230` ставит `outline: none !important` на фокус клетки → доска фокусируется, но невидима. Нет `aria-live` на часах (`ChessTimer.tsx:81`) и на «Шах!…/Мат!…/Ваш ход». `Modal.tsx:13-27` не trapping-ит фокус и не возвращает его. `GamePage.tsx:982` `ConfirmDialog({...}: any)` — без `role="dialog"` и без Escape. Осиротевшие `<label>` без `htmlFor` (`AuthModal.tsx:76,92`, `LocalPage.tsx:386`, `BotPage.tsx:354`, `ColorPickerModal.tsx:190,227,288`). `BoardPreview` в карточках (`LobbyPage.tsx:351`) — вложенная фокусируемая доска 64 клетки на карточку, нужна `aria-hidden` | фокус-ловушка в `Modal`, `aria-live` на часах и статусе, убрать `outline: none` |
| Мобильность | `GameLayout.tsx:32` `max-w-[1200px]` ограничивает колонку доски ~732px, из-за чего `max-width: 1600px` (`index.css:104`) и `--game-main-column-width: 1100px` недостижимы. `LocalPage.tsx:376` и `AtomicLocalPage.tsx:246` `max-h-[300px]` **без** вьюпортного ограничения. Нет `env(safe-area-inset-*)`, хотя `index.html:6` задаёт `viewport-fit=cover` → контент под вырезом и под home-индикатором. `SettingsDropdown.tsx:46,48` и `LobbyPage.tsx:215` используют `vh` вместо `dvh` | согласовать ширины, добавить safe-area, `dvh` |
| Дублирование UI | ~570–620 избыточных строк (~16% кода страниц). `GameLayout.tsx` существует, но **6 страниц его не используют** (`SpellLocalPage.tsx:349`, `SettingsPage.tsx:86`, `CompletedGamesPage.tsx:60`, `OnlineHubPage.tsx:175`, `OfflineHubPage.tsx:53`). `GamePage.tsx` (982 строки) — ~11 разных ответственностей | выделить `useSpellTargeting`, `useReactions`, статус-бар, историю ходов, карточку инвайта |
| Сборка | `vite.config.ts:18-20` — один чанк `vendor` на **все** `node_modules`, включая Firebase (~300 КБ), который нужен не всем. Порядок проверок `manualChunks` зависит от строковых путей и хрупок. `chunkSizeWarningLimit` не задан | выделить `firebase` отдельно, задать лимит |
| Деплой | `public/_headers` — формат Netlify/Cloudflare Pages, а деплой на **GitHub Pages** (`package.json:4`) → файл мёртв; пути в нём корневые и не учитывают `base`. **Security-заголовков ноль**: нет CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `HSTS` | заменить на серверный конфиг GitHub Pages; CSP — приоритетная мера и по COOP-предупреждению из `AGENTS.md` |
| SW | `sw.js:4` — только `skipWaiting()`, нет шага `install` с `addAll`, поэтому полноценный офлайн-запуск невозможен (README обещает офлайн-игру с ботом). Нет обработчика `message` для `SKIP_WAITING` | добавить precache манифеста |

---

## 5. Отложено сознательно

### Оптимизация движка — самый большой нереализованный выигрыш

**`src/lib/engine/PoisenChess.ts`, горячий путь `move()`**

На каждый сгенерированный ход `makeMoveInternal` (строки 314-449) делает:
1. `:320` клон доски, `:326` полный FEN (64 итерации)
2. `:422` **второй** полный FEN
3. `:423-429` ещё один клон доски + 6 полей
4. `:437-447` restore dance: восстановить «после», посчитать SAN, снова restore
5. `:438` → `sanBody:527-529` — `flatMap`, аллоцирующий **64 объекта** на любой не-пешке
6. `:533` → `pseudoLegalMoves(sq)` **для каждой** однотипной фигуры
7. `:448` → `sanSuffix:555` → `isCheckmate()` → `hasLegalMove()` → **генерация всех ходов заново**

Пункт 7 — ключевой: **вложенная генерация ходов внутри генерации ходов**. Поверх этого `move():560` **ещё раз** генерирует весь список легальных ходов ради `.find`, а `:578-580` вызывает `isCheckmate()` и `isDraw()` — каждая тянет ещё одну полную генерацию.

**Масштаб:**
- `perft(4)` стартовой позиции = **197 281** вызов `move()`. Замер на этой машине дважды уходил в таймаут за минуты — оценка сделана по чтению кода, без измерения
- `ichiBot.ts:113` вызывает `engine.moves({verbose:true})` в **каждом** узле minimax, а `:121`/`:130` — `engine.move()`, который повторно генерирует всё. Depth 4 ≈ 810 000 узлов × 2 полных прохода. Плюс `evaluate():84` вызывает `board()`, а `board():133` **клонирует** доску — аллокация O(64) в каждом листе

**Почему не сделано:** это рефакторинг на ~12 правок в горячем пути, а единственная его проверка — `perft`, который на этой машине непрактичен. Без возможности откатить через тесты такой рефакторинг опасен.

**План (оценка: 100–1000× на perft и поиске):**

| # | Правка | Место |
|---|---|---|
| 1 | Низкоуровневые `makeMove`/`unmakeMove` — применить/откатить ход **без** истории, SAN, FEN и result (стандартный дизайн, как в chess.js) | новое в `PoisenChess.ts` |
| 2 | Ленивые `san`/`before`/`after` через `defineProperty` с мемоизацией вместо eager-вычисления | `makeMoveInternal` |
| 3 | `move()` через `pseudoLegalMoves(from)` вместо полной генерации | `move():558-587` |
| 4 | `_gameResult` вычислять лениво в `gameResult()` с инвалидацией на `move`/`undo` | `move()`, `gameResult()` |
| 5 | Убрать restore dance | `makeMoveInternal:437-447` |
| 6 | `sanBody` — безаллокционный двойной цикл вместо `flatMap` | `sanBody:527-529` |
| 7 | `boardView()` без клонирования для `evaluate()` | `board()` |
| 8 | Перевести `ichiBot.ts:113/121/130` и хелпер perft на быстрый API | `ichiBot.ts` |
| 9 | Методы `perft(depth)` и **`perftDivide(depth)`** в движок | `PoisenChess.ts` |
| 10 | **Тест-бюджет производительности** — `perft(4)` укладывается в N мс | новый тест |
| 11 | Таймаут в `getBestMove` | `botEngine.ts` |
| 12 | alpha-beta на корне (сейчас полное окно на каждый корневой ход) | `ichiBot.ts:169` |

**Риск п. 2:** `Move` станет объектом с геттерами. Нужно проверить `{ ...found }` (строка 565) и JSON-сериализацию. Альтернатива при хрупкости: явный флаг `skipSan`.

**Ожидаемая польза:** perft начинает проходить, а бот 4-го уровня становится играбельным (сейчас он зависает).

**Перед началом:** замерить фактическое время perft на малых глубинах (1-3) с остановкой по порогу, чтобы получить коэффициент, а не полный прогон.

### `firestore.rules` — по решению владельца

`firestore.rules` не проверяет поля и результат. Что осталось незакрытым:

- **любой аутентифицированный клиент может объявить победу** — нет `affectedKeys()`, нет запрета на изменение при `game_state === 'game_over'`. Клиент пишет ровно эти поля сам (`useGameSync.ts:430-434`, `:607-618`; `GamePage.tsx:458-472`; `useGameTimer.ts:34-38`)
- **завершённую партию можно переписать** — поменять `winner` после сдачи, вернуть `game_state` в `'playing'`
- **идентичность игрока мутабельна** — проверяется `resource.data`, но не `request.resource.data`, поэтому можно сделать `update({white_player_id: <злоумышленник>, black_player_id: null})` и забрать партию
- **полупустые комнаты захватывает кто угодно** — условие `resource.data.white_player_id == null` достаточно для **любого** аутентифицированного пользователя; `useRoomJoin` (intended-гейт) правилами не обеспечен
- **`challenges` позволяет подделку** — `create` без проверки `request.resource.data.fromId == request.auth.uid`; `update` позволяет любой стороне переписать любое поле, включая `fromId`/`toId`/`gameId`
- глобальное чтение всех партий (uid обоих игроков, PGN) для любого залогиненного; `useRematch.ts:37` использует `Math.random()` вместо криптостойкого генератора (впрочем, `ColorPickerModal` тоже использует `Math.random()`, так что паритет есть)

Что в правилах сделано правильно: `match /{document=**} { allow read, write: if false }` корректно закрывает всё остальное; удаления для `games` запрещены; запись в `users` ограничена `request.auth.uid == userId`; захват слота в `useRoomJoin` пере-валидируется **внутри** транзакции.

**Минимальное усиление:** (а) `request.resource.data.diff(resource.data).affectedKeys().hasOnly([...])`; (б) иммутабельность `*_player_id`; (в) запрет менять `game_state`/`winner` при `game_over`; (г) починка `challenges`; (д) App Check.

### Остальное

- Таймеры, доступность, мобильность, дублирование, разбиение `GamePage`, `lint`-конфиг, CI — изложены в разделе 4 как предложения
- **PGN в режиме магии** остаётся пустым: `pgn()` и `history()` итерируют `moveStack`, пустой у пересозданного движка. Отдельная задача — нужна сериализация списка ходов (или реализация `loadPgn`, см. P1-9 шаг A/B)

---

## 6. Проверка изменений

### Команды

```bash
# Полная проверка одной командой — то же, что делает job `verify` в CI
npm run verify

# Отдельно: типы (~34 с)
npx tsc --noEmit

# Быстрые тесты: 74 зелёных, ~15 с
npm run test:fast

# ВАЖНО: `npm test` без аргументов запускает perft и на слабой машине уходит
# в таймаут на минуты. Отдельно и осознанно:
npm run test:perft

# Сборка (~10–21 с) + проверка подстановки в 404.html и sw.js
VITE_BASE=/gochess/ npx vite build
grep -q "'/gochess/'" dist/404.html && echo "база подставлена"
grep -q "__GOCHESS_VERSION__" dist/sw.js && echo "FAIL: версия не подставлена" || echo "версия подставлена"
```

### Текущий статус

| Проверка | Результат |
|---|---|
| `npx tsc --noEmit` | **0 ошибок** |
| `npm run test:fast` | **74 теста зелёные** (было 39) |
| `VITE_BASE=/gochess/ npx vite build` | успешно, ~10 с, подстановка работает |
| Проверки CI на собранном `dist` | все три проходят |
| YAML workflow | валиден, структура job-ов корректна |
| `npm run lint` | **не работает** — ESLint-конфига в проекте нет, хотя скрипт есть (`package.json:10`) и 6 плагинов установлены |
| `npm test` (полный) | **не проверен** — perft слишком тяжёлый на этой машине |

### Важное замечание о тестах

`tsconfig.json:24` содержит `"exclude": ["src/**/__tests__/**"]`, поэтому **тесты не проверяются типами** в `npm run build`. Если это исправлять, `useGameRequest.test.ts:102` и `gameStore.test.ts:14` содержат `any`, которые начнут падать.

`gameStore.test.ts:13-15` мокает `zustand/middleware` в no-op passthrough, поэтому весь путь гидратации persist (причина P0-4) **никогда не проверяется**. Нужен тест, перезагружающий стор.

Ожидаемые числа `perft` в `perft.test.ts` я сверил с `chaseprogramming.org/Perft_Results` — все 6 позиций канонические, так что после оптимизации движка значения должны совпасть.

---

## Приложение: карта файлов для быстрой ориентации

| Файл | Строк | Роль | Состояние |
|---|---|---|---|
| `src/pages/GamePage.tsx` | 992 | онлайн-игра | правился, остаётся монолитом с ~11 ответственностями |
| `src/lib/spellChessEngine.ts` | 948 | движок Spell Chess | **счётчик исправлен**, остальные 7 заглушек |
| `src/hooks/useGameSync.ts` | 897 | онлайн-синхронизация | правился, **0 тестов** |
| `src/lib/engine/PoisenChess.ts` | 789 | стандартный движок | правился, **perft-валидирован**, горячий путь медленный |
| `src/pages/SpellLocalPage.tsx` | 624 | локальная магия | работает (движок-синглтон), есть guard, которого нет в GamePage |
| `src/stores/gameStore.ts` | 408 | локальный/бот-стор | PGN теряется при перезагрузке |
| `src/hooks/useGameTimer.ts` | 91 | часы | спящего игрока не зафиксировать |
| `src/lib/bot/ichiBot.ts` | 179 | ИИ | корректен, но опирается на медленный движок |
| `src/hooks/useChallenges.ts` | 107 | вызовы | индексы добавлены, логика с гонками |
| `src/hooks/useAuth.ts` | 155 | авторизация | 15 мест вызова без селектора |
| `src/hooks/useGameRequest.ts` | 106 | отмена/ничья | **нет валидаций**, P0-2/P0-3 |
| `src/lib/engine/AtomicChessEngine.ts` | 114 | Atomic | потеря истории исправлена, правила Atomic частично нет |
| `firestore.rules` | 37 | безопасность | пропускает подделку результатов |
