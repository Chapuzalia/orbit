import { createServer } from 'node:http'
import { timingSafeEqual } from 'node:crypto'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createOrbitServer } from './server.mjs'

export function createOrbitHttpServer(service, { token, allowedHosts = ['127.0.0.1', 'localhost', '[::1]'], allowedOrigins = [] } = {}) {
  if (!token || token.length < 32) throw new Error('HTTP requiere ORBIT_MCP_HTTP_TOKEN de al menos 32 caracteres.')
  const expected = Buffer.from(`Bearer ${token}`)
  return createServer({ requestTimeout: 20000, headersTimeout: 10000 }, async (req, res) => {
    const send = (status, message) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify({ error: message })) }
    let host
    try { host = new URL(`http://${req.headers.host}`).hostname } catch { send(400, 'Host inválido.'); return }
    if (!allowedHosts.includes(host)) { send(403, 'Host no permitido.'); return }
    if (req.headers.origin && !allowedOrigins.includes(req.headers.origin)) { send(403, 'Origen no permitido.'); return }
    const supplied = Buffer.from(req.headers.authorization || '')
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) { send(401, 'Autenticación requerida.'); return }
    if (req.url !== '/mcp') { send(404, 'Ruta no encontrada.'); return }
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); send(405, 'Utiliza POST /mcp.'); return }
    if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) { send(415, 'Content-Type debe ser application/json.'); return }
    const chunks = []
    let length = 0
    let body
    try {
      for await (const chunk of req) {
        length += chunk.length
        if (length > 1024 * 1024) { send(413, 'Petición demasiado grande.'); return }
        chunks.push(chunk)
      }
      body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    } catch { if (!res.destroyed) send(400, 'JSON inválido.'); return }
    const server = createOrbitServer(service)
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
    res.setHeader('Cache-Control', 'no-store')
    res.on('close', () => { void server.close() })
    try { await server.connect(transport); await transport.handleRequest(req, res, body) }
    catch { if (!res.headersSent) send(500, 'No se pudo procesar la petición MCP.'); else res.end() }
  })
}
