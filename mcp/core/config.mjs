function boolean(value, fallback, name) {
  if (value === undefined || value === '') return fallback
  if (!['true', 'false'].includes(value)) throw new Error(`${name} debe ser true o false.`)
  return value === 'true'
}
const csv = (value) => value?.split(',').map((part) => part.trim()).filter(Boolean)

export function readCoreConfig(env = process.env) {
  const modules = csv(env.ALTEIL_MODULES ?? 'orbit') || []
  if (!modules.length || new Set(modules).size !== modules.length) throw new Error('ALTEIL_MODULES debe contener módulos únicos, separados por comas.')
  const transport = env.ALTEIL_MCP_TRANSPORT ?? env.ORBIT_MCP_TRANSPORT ?? 'stdio'
  if (!['stdio', 'http'].includes(transport)) throw new Error('ALTEIL_MCP_TRANSPORT debe ser stdio o http.')
  const port = Number(env.ALTEIL_MCP_PORT ?? env.ORBIT_MCP_PORT ?? 3100)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('ALTEIL_MCP_PORT inválido.')
  return { modules, transport, port,
    host: env.ALTEIL_MCP_HOST ?? env.ORBIT_MCP_HOST ?? '127.0.0.1',
    token: env.ALTEIL_MCP_HTTP_TOKEN ?? env.ORBIT_MCP_HTTP_TOKEN,
    allowedHosts: csv(env.ALTEIL_MCP_ALLOWED_HOSTS ?? env.ORBIT_MCP_ALLOWED_HOSTS),
    allowedOrigins: csv(env.ALTEIL_MCP_ALLOWED_ORIGINS ?? env.ORBIT_MCP_ALLOWED_ORIGINS),
    readOnly: boolean(env.ALTEIL_MCP_READ_ONLY, false, 'ALTEIL_MCP_READ_ONLY'),
  }
}

export { boolean as readBoolean }
