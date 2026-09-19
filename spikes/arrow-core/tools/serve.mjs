// Zero-dependency static server for the debug viewer. Serves the spike root so the viewer can
// import the compiled core from /dist/src/index.js.
import { createServer } from 'node:http'
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const port = Number(process.env.PORT ?? process.argv[2] ?? 5177)
const types = { '.html': 'text/html', '.js': 'text/javascript', '.map': 'application/json', '.json': 'application/json', '.css': 'text/css' }

// TOOL-001: read-only source for the Creature Pose Editor -- a sibling project directory, not
// under `root`, so it needs its own two endpoints below rather than the generic static handler.
// This absolute default matches the path already referenced throughout .orchestra/tasks/ on this
// single-user local dev machine; override with MAGICARROW_CREATURES_DIR if that ever changes.
const MAGICARROW_CREATURES_DIR = process.env.MAGICARROW_CREATURES_DIR
  || 'C:\\Users\\nerza\\Projects\\magicarrowassets\\creatures'
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp'])
/** Folder/file name from a query param, rejecting anything that isn't a single plain path
 * segment (no `/`, `\`, or `..`) -- the only defense this needs, since both endpoints below join
 * it under a fixed root and never accept a full path from the client. */
function safeSegment(name) {
  return typeof name === 'string' && name.length > 0 && /^[^/\\]+$/.test(name) && name !== '..' ? name : null
}

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

  // TOOL-001: list image files in a creature's SOURCE folder (read-only -- this tool never
  // writes into magicarrowassets, only reads it to populate the pose editor's file picker).
  if (req.method === 'GET' && url.pathname === '/api/creature-source/list') {
    const folder = safeSegment(url.searchParams.get('species'))
    if (!folder) {
      res.writeHead(400, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: 'invalid or missing species' }))
      return
    }
    try {
      const dir = join(MAGICARROW_CREATURES_DIR, folder)
      const entries = await readdir(dir, { withFileTypes: true })
      const files = entries
        .filter((e) => e.isFile() && IMAGE_EXT.has(extname(e.name).toLowerCase()))
        .map((e) => e.name)
        .sort()
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' })
      res.end(JSON.stringify({ ok: true, files }))
    } catch {
      res.writeHead(404, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: `no source folder for "${folder}"` }))
    }
    return
  }

  // TOOL-001: stream one raw source image for the pose editor's live preview/file list -- lives
  // outside `root` (magicarrowassets is a sibling project directory), so the generic static
  // handler below can't reach it.
  if (req.method === 'GET' && url.pathname === '/api/creature-source/file') {
    const folder = safeSegment(url.searchParams.get('species'))
    const name = safeSegment(url.searchParams.get('name'))
    if (!folder || !name || !IMAGE_EXT.has(extname(name).toLowerCase())) {
      res.writeHead(400).end()
      return
    }
    const dir = join(MAGICARROW_CREATURES_DIR, folder)
    const file = normalize(join(dir, name))
    if (!file.startsWith(dir)) {
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
    return
  }

  // TOOL-001: save one species' pose assignment. Body: { species, sourceFolder,
  // poses: { <poseName>: <sourceFileName> }, pivot?: {x,y}, scale?: number,
  // hudOffset?: {x,y}, hudScale?: number, shadowOffset?: {x,y} }. For each assigned
  // pose this COPIES the chosen frame from the magicarrowassets source folder into a real
  // project-local file (assets/enemies/<species>/<poseName>.png), same convention every other
  // species' art already uses (see ASSET-002/ASSET-003) -- the manifest never points back at the
  // sibling magicarrowassets directory, so the project stays self-contained. Read-modify-write on
  // viewer/visual-proto/creature-poses.json (only this species' entry is replaced, every other
  // species already saved stays intact) -- the same file assets.js's applyPoseOverrides() reads.
  if (req.method === 'POST' && url.pathname === '/api/creature-poses/save') {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', async () => {
      try {
        const { species, sourceFolder, poses, pivot, scale, hudOffset, hudScale, shadowOffset } = JSON.parse(body)
        if (!safeSegment(species) || !safeSegment(sourceFolder) || !poses || typeof poses !== 'object') {
          throw new Error('invalid payload')
        }
        const srcDir = join(MAGICARROW_CREATURES_DIR, sourceFolder)
        const destDir = join(root, 'viewer', 'visual-proto', 'assets', 'enemies', species)
        await mkdir(destDir, { recursive: true })
        const savedPoses = {}
        for (const [poseName, sourceFileName] of Object.entries(poses)) {
          if (!safeSegment(poseName) || !safeSegment(sourceFileName)) continue
          const ext = extname(sourceFileName).toLowerCase()
          if (!IMAGE_EXT.has(ext)) continue
          const srcFile = normalize(join(srcDir, sourceFileName))
          if (!srcFile.startsWith(srcDir)) continue
          const destFile = join(destDir, `${poseName}${ext}`)
          await writeFile(destFile, await readFile(srcFile))
          savedPoses[poseName] = `assets/enemies/${species}/${poseName}${ext}`
        }
        const manifestFile = join(root, 'viewer', 'visual-proto', 'creature-poses.json')
        let manifest = {}
        try { manifest = JSON.parse(await readFile(manifestFile, 'utf-8')) } catch {}
        // `sourceFiles` round-trips the original magicarrowassets filenames (poses only holds the
        // resolved project-local path) so the editor can restore which source frame was picked
        // per pose next time this species is opened, without guessing from the destination path.
        // CAL-005: hudOffset/shadowOffset are validated the same way species-presentation.js
        // validates them at runtime (finite x/y) -- malformed values persist as null and read
        // back as the {0,0} no-op, so old and new entries stay mutually compatible.
        const xyOrNull = (v) => (v && Number.isFinite(v.x) && Number.isFinite(v.y) ? { x: v.x, y: v.y } : null)
        const numOr = (v, fallback) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fallback)
        manifest[species] = { poses: savedPoses, sourceFiles: poses, pivot: xyOrNull(pivot), scale: numOr(scale, 1), hudOffset: xyOrNull(hudOffset), hudScale: numOr(hudScale, 1), shadowOffset: xyOrNull(shadowOffset) }
        await writeFile(manifestFile, JSON.stringify(manifest, null, 2), 'utf-8')
        res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' })
        res.end(JSON.stringify({ ok: true, file: 'viewer/visual-proto/creature-poses.json', entry: manifest[species] }))
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
  console.log(`▶ Playable Prologue:      http://localhost:${port}/viewer/visual-proto/
  HUD Approved Adaptation:http://localhost:${port}/viewer/hud-approved-adaptation.html
  Campaign Editor:        http://localhost:${port}/viewer/visual-proto/calibration-editor.html
  core debug viewer:      http://localhost:${port}/viewer/index.html#preset=medium&seed=1
  combat prologue:        http://localhost:${port}/viewer/cp-prologue.html
  gray prologue:          http://localhost:${port}/viewer/prologue.html`)
})
