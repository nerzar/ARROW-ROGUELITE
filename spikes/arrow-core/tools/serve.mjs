// Zero-dependency static server for the debug viewer. Serves the spike root so the viewer can
// import the compiled core from /dist/src/index.js.
import { createServer } from 'node:http'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const port = Number(process.env.PORT ?? process.argv[2] ?? 5177)
const types = { '.html': 'text/html', '.js': 'text/javascript', '.map': 'application/json', '.json': 'application/json', '.css': 'text/css' }

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')

  // API: Save campaign JSON to real project file
  if (req.method === 'POST' && url.pathname === '/api/campaign/save') {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', async () => {
      try {
        const data = JSON.parse(body)
        const campaignDir = join(root, 'campaigns')
        await mkdir(campaignDir, { recursive: true })
        const targetFile = join(campaignDir, 'campaign.json')
        await writeFile(targetFile, JSON.stringify(data, null, 2), 'utf-8')
        res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' })
        res.end(JSON.stringify({ ok: true, file: 'campaigns/campaign.json', timestamp: Date.now() }))
      } catch (err) {
        res.writeHead(500, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: String(err) }))
      }
    })
    return
  }

  // API: Load campaign JSON from project file
  if (req.method === 'GET' && url.pathname === '/api/campaign/load') {
    const targetFile = join(root, 'campaigns', 'campaign.json')
    try {
      const raw = await readFile(targetFile, 'utf-8')
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' })
      res.end(raw)
    } catch {
      res.writeHead(404, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: 'no campaign file found' }))
    }
    return
  }

  // BUILD-029: API: Import a locally picked arena image into the real project file tree,
  // so "Import Arena" writes a real asset instead of only a browser-side dataURL.
  if (req.method === 'POST' && url.pathname === '/api/assets/import-arena') {
    const chunks = []
    let size = 0
    let tooLarge = false
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > 15 * 1024 * 1024) { tooLarge = true; req.destroy(); return }
      chunks.push(chunk)
    })
    req.on('end', async () => {
      if (tooLarge) {
        res.writeHead(413, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: 'image too large (max 15MB)' }))
        return
      }
      try {
        const { filename, dataBase64 } = JSON.parse(Buffer.concat(chunks).toString('utf-8'))
        const ext = extname(String(filename ?? '')).toLowerCase()
        const allowedExt = new Set(['.png', '.jpg', '.jpeg', '.webp'])
        if (!allowedExt.has(ext)) throw new Error(`unsupported image type "${ext || '(none)'}"`)
        const safeBase = String(filename).replace(/[/\\]/g, '_').replace(/[^a-zA-Z0-9_.-]/g, '_')
        const finalName = `${Date.now()}-${safeBase}`
        const dir = join(root, 'viewer', 'visual-proto', 'assets', 'arenas', 'imported')
        await mkdir(dir, { recursive: true })
        const targetFile = normalize(join(dir, finalName))
        if (!targetFile.startsWith(dir)) throw new Error('invalid file name')
        await writeFile(targetFile, Buffer.from(String(dataBase64), 'base64'))
        const relPath = `assets/arenas/imported/${finalName}`
        res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' })
        res.end(JSON.stringify({ ok: true, path: relPath }))
      } catch (err) {
        res.writeHead(400, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: String(err.message ?? err) }))
      }
    })
    return
  }

  if (url.pathname === '/' || url.pathname === '/viewer' || url.pathname === '/viewer/') {
    res.writeHead(302, { location: '/viewer/visual-proto/' }).end()
    return
  }
  const rel = url.pathname.endsWith('/') ? `${url.pathname}index.html` : url.pathname
  const file = normalize(join(root, decodeURIComponent(rel)))
  if (!file.startsWith(root)) {
    res.writeHead(403).end()
    return
  }
  try {
    const body = await readFile(file)
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' })
    res.end(body)
  } catch {
    res.writeHead(404).end('not found')
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`▶ Playable Prologue:  http://localhost:${port}/viewer/visual-proto/
  Campaign Editor:    http://localhost:${port}/viewer/visual-proto/calibration-editor.html
  core debug viewer:  http://localhost:${port}/viewer/index.html#preset=medium&seed=1
  combat prologue:    http://localhost:${port}/viewer/cp-prologue.html
  gray prologue:      http://localhost:${port}/viewer/prologue.html`)
})
