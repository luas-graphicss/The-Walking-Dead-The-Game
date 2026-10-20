import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { setImmediate } from 'node:timers/promises'
import { Zip, ZipDeflate, strToU8 } from 'fflate'

export const ARCHIVE_FOLDER = 'the-walking-dead-procedural'
const ALWAYS_SKIP = [
  /^node_modules$/, /^\.next$/, /^\.git$/, /^\.vercel$/, /^\.env/, /^__v0_/, /^\.v0-trash$/, /^\.snowflake$/,
  /^user_read_only_context$/, /^v0_memories$/, /^artifacts$/, /^\.v0$/, /^\.DS_Store$/, /\.tsbuildinfo$/,
  /^__pycache__$/, /\.(?:zip|7z|tar|gz|log|pem|key|p12|pfx)$/i, /^\.npmrc$/, /^\.pnpm-store$/,
]

type IgnoreRule = { anchored: boolean; directoryOnly: boolean; pattern: RegExp }
type SourceFile = { relative: string; bytes: number }

function globToRegExp(glob: string) {
  return new RegExp(`^${glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]').replace(/\u0000/g, '.*')}$`)
}

async function readIgnoreRules(root: string): Promise<IgnoreRule[]> {
  const text = await readFile(path.join(root, '.gitignore'), 'utf8').catch(() => '')
  return text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#') && !line.startsWith('!')).map((line) => {
    const directoryOnly = line.endsWith('/'), body = line.replace(/^\//, '').replace(/\/$/, '')
    return { anchored: line.startsWith('/') || body.includes('/'), directoryOnly, pattern: globToRegExp(body) }
  })
}

export async function sourceInventory(root: string) {
  const rules = await readIgnoreRules(root), files: SourceFile[] = []
  async function collect(directory = '') {
    const entries = await readdir(path.join(root, directory), { withFileTypes: true })
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      const relative = directory ? `${directory}/${entry.name}` : entry.name
      if (entry.isSymbolicLink() || ALWAYS_SKIP.some((pattern) => pattern.test(entry.name))) continue
      if (rules.some((rule) => (!rule.directoryOnly || entry.isDirectory()) && rule.pattern.test(rule.anchored ? relative : entry.name))) continue
      if (entry.isDirectory()) await collect(relative)
      else if (entry.isFile()) files.push({ relative, bytes: (await stat(path.join(root, relative))).size })
    }
  }
  await collect()
  return files
}

export function sourceArchive(root: string, files: SourceFile[]) {
  let cancelled = false, wake: (() => void) | undefined
  return new ReadableStream<Uint8Array>({
    start(controller) {
      void (async () => {
      const zip = new Zip((error, chunk, final) => {
        if (cancelled) return
        if (error) { cancelled = true; controller.error(error); wake?.(); return }
        controller.enqueue(chunk)
        if (final) controller.close()
      })
      const manifest: { path: string; bytes: number; sha256: string }[] = []
      const entry = (name: string) => {
        const file = new ZipDeflate(`${ARCHIVE_FOLDER}/${name}`, { level: 9, mem: 8 })
        file.mtime = new Date('2000-01-01T00:00:00Z')
        zip.add(file)
        return file
      }
      try {
        for (const source of files) {
          if (cancelled) break
          const file = entry(source.relative), hash = createHash('sha256')
          let bytes = 0
          for await (const buffer of createReadStream(path.join(root, source.relative), { highWaterMark: 131072 })) {
            if (cancelled) break
            const chunk = buffer as Buffer
            hash.update(chunk); bytes += chunk.byteLength
            file.push(chunk, false)
            if ((controller.desiredSize ?? 0) <= 0) await new Promise<void>((resolve) => { wake = resolve })
            await setImmediate()
          }
          if (cancelled) break
          file.push(new Uint8Array(), true)
          manifest.push({ path: source.relative, bytes, sha256: hash.digest('hex') })
        }
        if (!cancelled) {
          const inventory = entry('source-manifest.json')
          inventory.push(strToU8(JSON.stringify({ format: 1, complete: true, files: manifest }, null, 2)), true)
          zip.end()
        }
      } catch (error) {
        if (!cancelled) { cancelled = true; controller.error(error) }
      }
      if (cancelled) zip.terminate()
      })()
    },
    pull() { wake?.(); wake = undefined },
    cancel() { cancelled = true; wake?.() },
  }, { highWaterMark: 1048576, size: (chunk) => chunk.byteLength })
}
