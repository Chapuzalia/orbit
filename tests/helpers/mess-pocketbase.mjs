import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { mkdir, mkdtemp } from 'node:fs/promises'
import { once } from 'node:events'
import { createServer } from 'node:net'
import { resolve, join } from 'node:path'
import PocketBase from 'pocketbase'

export async function startMessPocketBase(t) {
  const root = resolve(import.meta.dirname, '../..')
  const binary = process.env.POCKETBASE_TEST_BINARY || join(root, '.pocketbase-test', process.platform === 'win32' ? 'pocketbase.exe' : 'pocketbase')
  await mkdir(join(root, '.pocketbase-test'), { recursive: true })
  const directory = await mkdtemp(join(root, '.pocketbase-test', 'mess-mcp-'))
  const args = [`--dir=${join(directory, 'data')}`, `--migrationsDir=${join(root, 'tests/fixtures/mess/pb_migrations')}`, `--hooksDir=${join(root, 'tests/fixtures/mess/pb_hooks')}`]
  for (const command of [['migrate', 'up'], ['superuser', 'upsert', 'mess-admin@example.com', 'Local-mess-password-123']]) {
    const result = spawnSync(binary, [...command, ...args], { encoding: 'utf8', windowsHide: true })
    assert.equal(result.status, 0, result.stderr || result.stdout || result.error?.message)
  }
  const probe = createServer()
  await new Promise((done) => probe.listen(0, '127.0.0.1', done))
  const port = probe.address().port
  await new Promise((done) => probe.close(done))
  const child = spawn(binary, ['serve', `--http=127.0.0.1:${port}`, '--automigrate=0', '--hooksWatch=false', ...args], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  t.after(async () => { if (child.exitCode !== null) return; const closed = once(child, 'exit'); child.kill(); await closed })
  let logs = ''
  child.stdout.on('data', (value) => { logs += value })
  child.stderr.on('data', (value) => { logs += value })
  const url = `http://127.0.0.1:${port}`
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(`${url}/api/health`)).ok) break } catch {}
    if (attempt === 99) assert.fail(logs)
    await new Promise((done) => setTimeout(done, 100))
  }
  const admin = new PocketBase(url)
  admin.autoCancellation(false)
  await admin.collection('_superusers').authWithPassword('mess-admin@example.com', 'Local-mess-password-123')
  const password = 'Local-staff-password-123'
  const user = await admin.collection('users').create({ email: 'mess-mcp@example.com', password, passwordConfirm: password, role: 'admin' })
  const staff = await admin.collection('users').create({ email: 'mess-staff@example.com', password, passwordConfirm: password, role: 'user' })
  const env = { ALTEIL_MODULES: 'mess', MESS_POCKETBASE_URL: url, MESS_USER_EMAIL: user.email, MESS_USER_PASSWORD: password }
  return { admin, user, staff, password, env, url }
}
