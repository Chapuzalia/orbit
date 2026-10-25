// Explicit allowlist: environment variables cannot import arbitrary files or packages.
const loaders = {
  orbit: () => import('../modules/orbit/index.mjs'),
  tickit_pos: () => import('../modules/tickit-pos/index.mjs'),
  mess: () => import('../modules/mess/index.mjs'),
}

export async function loadModules(config, env = process.env) {
  for (const id of config.modules) if (!Object.hasOwn(loaders, id)) throw new Error(`Módulo desconocido: ${id}. Disponibles: ${Object.keys(loaders).join(', ')}.`)
  const modules = []
  for (const id of config.modules) {
    const { loadModule } = await loaders[id]()
    const module = await loadModule(env)
    if (module.id !== id || typeof module.register !== 'function' || typeof module.health !== 'function') throw new Error(`Contrato de módulo inválido: ${id}.`)
    if (config.readOnly) module.config.readOnly = true
    modules.push(module)
  }
  return modules
}
