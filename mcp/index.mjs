#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { OrbitService, readConfig } from './service.mjs'
import { createOrbitServer } from './server.mjs'
import { createOrbitHttpServer } from './http.mjs'

try {
  const service = new OrbitService(readConfig())
  const transport = process.env.ORBIT_MCP_TRANSPORT || 'stdio'
  if (transport === 'stdio') {
    const server = createOrbitServer(service)
    await server.connect(new StdioServerTransport())
    const stop = async () => { await server.close(); process.exit(0) }
    process.once('SIGINT', stop)
    process.once('SIGTERM', stop)
  } else if (transport === 'http') {
    const csv = (value) => value?.split(',').map((part) => part.trim()).filter(Boolean)
    const port = Number(process.env.ORBIT_MCP_PORT || 3100)
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('ORBIT_MCP_PORT inválido.')
    const http = createOrbitHttpServer(service, { token: process.env.ORBIT_MCP_HTTP_TOKEN,
      allowedHosts: csv(process.env.ORBIT_MCP_ALLOWED_HOSTS), allowedOrigins: csv(process.env.ORBIT_MCP_ALLOWED_ORIGINS) })
    http.on('error', () => { console.error('No se pudo iniciar el puerto HTTP del MCP.'); process.exit(1) })
    http.listen(port, process.env.ORBIT_MCP_HOST || '127.0.0.1', () => console.error(`Orbit MCP disponible en puerto ${port}, ruta /mcp.`))
    const stop = () => { http.close(); http.closeAllConnections() }
    process.once('SIGINT', stop)
    process.once('SIGTERM', stop)
  } else throw new Error('ORBIT_MCP_TRANSPORT debe ser stdio o http.')
} catch (error) {
  console.error(`Orbit MCP: ${error.message}`)
  process.exitCode = 1
}
