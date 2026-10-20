import { buildMotionTables, motionTransferables, type MotionTables } from './motion-tables'

export type MotionRequest = { url: string }
export type MotionReply = { tables: MotionTables } | { error: string }

const scope = self as unknown as {
  onmessage: (event: MessageEvent<MotionRequest>) => void
  postMessage: (message: MotionReply, transfer?: Transferable[]) => void
}

scope.onmessage = async ({ data }) => {
  try {
    const response = await fetch(data.url)
    if (!response.ok) throw new Error(`motion database: HTTP ${response.status}`)
    const tables = await buildMotionTables(await response.arrayBuffer())
    scope.postMessage({ tables }, motionTransferables(tables))
  } catch (error) {
    scope.postMessage({ error: error instanceof Error ? error.message : String(error) })
  }
}
