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
  if (url.pathname === '/' || url.pathname === '/viewer') {
    res.writeHead(302, { location: '/viewer/' }).end()
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
  console.log(`arrow-core viewer: http://localhost:${port}/viewer/#preset=medium&seed=1
 mini-boss:         http://localhost:${port}/viewer/encounter.html
 gray prologue:     http://localhost:${port}/viewer/prologue.html
 combat prologue:   http://localhost:${port}/viewer/cp-prologue.html`)
})
