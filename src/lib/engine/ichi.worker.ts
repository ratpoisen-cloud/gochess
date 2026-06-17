import { getIchiMove, type IchiConfig } from './ichiBot'

self.onmessage = (e: MessageEvent<{ fen: string; config: IchiConfig }>) => {
  const { fen, config } = e.data
  const result = getIchiMove(fen, config)
  self.postMessage(result)
}
