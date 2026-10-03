import { getIchiMove, type IchiConfig } from './ichiBot'

self.onmessage = (e: MessageEvent<{ id: number; fen: string; config: IchiConfig }>) => {
  const { id, fen, config } = e.data
  const result = getIchiMove(fen, config)
  self.postMessage({ id, result })
}
