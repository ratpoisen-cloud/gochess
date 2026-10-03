export interface GameLike {
  id?: string
  game_type?: string
}

/**
 * Куда вести игрока по клику на карточку партии.
 *
 * `online` → комната, `bot` → страница бота с загрузкой из архива.
 * Локальные партии маршрута не имеют (доска живёт в gameStore), поэтому
 * null — архив их показывает, но не открывает, как и лобби.
 *
 * Единая точка для LobbyPage и CompletedGamesPage: раньше архив вёл
 * бот-партии на /game/:id, где их не существует, — «мёртвая» комната.
 */
export function gameRoute(game: GameLike): string | null {
  if (!game.id) return null
  if (game.game_type === 'online') return `/game/${game.id}`
  if (game.game_type === 'bot') return `/bot?game=${game.id}`
  return null
}
