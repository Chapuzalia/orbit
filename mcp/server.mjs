// Existing imports keep working; production bootstrap uses the modular registry.
import { createAlteilServer } from './core/server.mjs'
import { createOrbitModule } from './modules/orbit/index.mjs'
export function createOrbitServer(service) { return createAlteilServer({ modules: [createOrbitModule(service)] }) }
