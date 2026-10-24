import { createAlteilHttpServer } from './transports/http.mjs'
import { createOrbitServer } from './server.mjs'
export function createOrbitHttpServer(service, options) { return createAlteilHttpServer(() => createOrbitServer(service), options) }
