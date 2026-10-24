import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
export async function startStdio(createServer) {
  const server = createServer()
  await server.connect(new StdioServerTransport())
  return server
}
