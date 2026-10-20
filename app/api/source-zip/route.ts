import { sourceArchive, sourceInventory } from '@/lib/source-archive'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET() {
  try {
    const root = process.cwd()
    const files = await sourceInventory(root)
    const archive = sourceArchive(root, files)
    const stamp = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '')
    return new Response(archive, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="the-walking-dead-source-${stamp}.zip"`,
        'Cache-Control': 'no-store',
        'X-Source-Files': String(files.length),
        'X-Source-Bytes': String(files.reduce((sum, file) => sum + file.bytes, 0)),
      },
    })
  } catch (error) {
    console.error('[source-zip] Falha ao empacotar o código-fonte:', error)
    return Response.json({ error: 'Não foi possível gerar o pacote do código-fonte.' }, { status: 500 })
  }
}
