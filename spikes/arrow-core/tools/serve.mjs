// Zero-dependency static server for the debug viewer. Serves the spike root so the viewer can
// import the compiled core from /dist/src/index.js.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const port = Number(process.env.PORT ?? process.argv[2] ?? 5177)
const types = { '.html': 'text/html', '.js': 'text/javascript', '.map': 'application/json', '.json': 'application/json', '.css': 'text/css' }

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
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
  console.log(`▶ Playable Prologue: http://localhost:${port}/viewer/visual-proto/
  calibration editor: http://localhost:${port}/viewer/visual-proto/calibration-editor.html
  core debug viewer:  http://localhost:${port}/viewer/index.html#preset=medium&seed=1
  combat prologue:    http://localhost:${port}/viewer/cp-prologue.html
  gray prologue:      http://localhost:${port}/viewer/prologue.html`)
})
