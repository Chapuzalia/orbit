#!/usr/bin/env node
import { readCoreConfig } from './core/config.mjs'
import { loadModules } from './core/registry.mjs'
import { createAlteilServer } from './core/server.mjs'
import { startStdio } from './transports/stdio.mjs'
import { createAlteilHttpServer } from './transports/http.mjs'

try {
  const config = readCoreConfig()
  const modules = await loadModules(config)
  const createServer = () => createAlteilServer({ modules, readOnly: config.readOnly })
  if (config.transport === 'stdio') {
    const server = await startStdio(createServer)
    const stop = async () => { await server.close(); process.exit(0) }
    process.once('SIGINT', stop)
    process.once('SIGTERM', stop)
  } else {
    // Validate registrations before accepting traffic (duplicates and module contracts fail startup).
    await createServer().close()
    const http = createAlteilHttpServer(createServer, config)
    http.on('error', () => { console.error('No se pudo iniciar el puerto HTTP del MCP.'); process.exit(1) })
    http.listen(config.port, config.host, () => console.error(`Alteil MCP disponible en puerto ${config.port}, ruta /mcp. Módulos: ${modules.map((module) => module.id).join(', ')}.`))
    const stop = () => { http.close(); http.closeAllConnections() }
    process.once('SIGINT', stop)
    process.once('SIGTERM', stop)
  }
} catch (error) {
  console.error(`Alteil MCP: ${error.message}`)
  process.exitCode = 1
}
