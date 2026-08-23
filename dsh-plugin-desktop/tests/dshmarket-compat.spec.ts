import { createRequire } from 'node:module'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Readable } from 'node:stream'
import { afterEach, describe, expect, it, vi } from 'vitest'

interface DesktopOperationHandle {
  readonly stdout: NodeJS.ReadableStream
  readonly stderr: NodeJS.ReadableStream
  readonly done: Promise<{ readonly exitCode: number | null; readonly signal: NodeJS.Signals | null }>
  cancel(): void
}

interface DshMarketRuntime {
  runPlugin(profile: string, args: string[]): Promise<{
    readonly exitCode: number | null
    readonly timedOut: boolean
    readonly cancelled: boolean
  }>
  dispose(): Promise<void>
}

const originalFetch = globalThis.fetch
const temporaryProfiles: string[] = []

afterEach(() => {
  globalThis.fetch = originalFetch
  for (const profile of temporaryProfiles.splice(0)) rmSync(profile, { recursive: true, force: true })
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

async function runtimeFactory(): Promise<(
  service: object,
  activeProfileDir: string,
  invokingDir?: string,
) => DshMarketRuntime> {
  const require = createRequire(import.meta.url)
  const manifest = require.resolve('dshmarket/package.json')
  const moduleUrl = pathToFileURL(join(dirname(manifest), 'lib', 'dsh-cli.js')).href
  const loaded = await import(moduleUrl) as {
    createDesktopPluginRuntime: (
      service: object,
      activeProfileDir: string,
      invokingDir?: string,
    ) => DshMarketRuntime
  }
  return loaded.createDesktopPluginRuntime
}

function completedHandle(): DesktopOperationHandle {
  return {
    stdout: Readable.from([]),
    stderr: Readable.from([]),
    done: Promise.resolve({ exitCode: 0, signal: null }),
    cancel: vi.fn(),
  }
}

describe('dsh-market Desktop install compatibility', () => {
  it('offers the host-provided market update when the Profile omits dshmarket', async () => {
    for (const name of ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy']) {
      vi.stubEnv(name, '')
    }
    globalThis.fetch = vi.fn(async () => new Response(
      JSON.stringify({ version: '1.20.0' }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ))

    const profileDir = mkdtempSync(join(tmpdir(), 'dshmarket-desktop-self-update-'))
    temporaryProfiles.push(profileDir)
    writeFileSync(join(profileDir, 'package.json'), JSON.stringify({
      name: 'dsh-profile-desktop',
      private: true,
      dependencies: {},
    }))

    const require = createRequire(import.meta.url)
    const manifest = require.resolve('dshmarket/package.json')
    const routesUrl = pathToFileURL(join(dirname(manifest), 'lib', 'routes.js')).href
    const loaded = await import(routesUrl) as {
      mountMarketRoutes: (
        host: object,
        config: { profile: string; profileDirectory: string; allowRestart: boolean },
      ) => () => void
    }
    const routes = new Map<string, (request: object, response: object) => void | Promise<void>>()
    const dispose = loaded.mountMarketRoutes({
      webServer: {
        register(route: { path: string; handler: (request: object, response: object) => void | Promise<void> }) {
          routes.set(route.path, route.handler)
          return () => routes.delete(route.path)
        },
      },
      loader: { entries: () => [] },
      plugin: () => ({ await: async () => undefined, dispose: () => undefined }),
    }, { profile: 'desktop', profileDirectory: profileDir, allowRestart: false })

    let status = 0
    let body = ''
    await routes.get('/dsh-market/updates')?.(
      { method: 'GET', url: '/dsh-market/updates?force=1' },
      {
        writeHead(code: number) { status = code },
        end(chunk?: string) { body = chunk ?? '' },
      },
    )
    dispose()

    expect(status).toBe(200)
    expect(JSON.parse(body).updates.dshmarket).toMatchObject({
      kind: 'npm',
      version: '1.17.1',
      current: '1.17.1',
      latest: '1.20.0',
      updateAvailable: true,
    })

    const client = readFileSync(join(dirname(manifest), 'client', 'client.js'), 'utf8')
    expect(client).toContain('installed["dshmarket"] !== void 0 || updates["dshmarket"] !== void 0')
    expect(client).toContain('const self = selfName')
  })

  it.each([
    '@liustack/modlens',
    '@liustack/modlens@latest',
  ])('resolves npm latest target %s and enters the external Market install boundary', async (target) => {
    for (const name of ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy']) {
      vi.stubEnv(name, '')
    }
    globalThis.fetch = vi.fn(async () => new Response(
      JSON.stringify({ version: '3.18.1' }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ))
    const runPlugin = vi.fn(() => completedHandle())
    const runExternalMarketPluginInstall = vi.fn((
      _args: readonly string[],
      _invokingDir: string,
      _signal?: AbortSignal,
    ) => completedHandle())
    const createRuntime = await runtimeFactory()
    const runtime = createRuntime(
      { runPlugin, runExternalMarketPluginInstall },
      '/private/dsh-profile',
      '/private/dsh-invoking',
    )

    await expect(runtime.runPlugin('desktop', ['add', target])).resolves.toMatchObject({
      exitCode: 0,
      timedOut: false,
      cancelled: false,
    })
    expect(runPlugin).not.toHaveBeenCalled()
    expect(runExternalMarketPluginInstall).toHaveBeenCalledOnce()
    expect(runExternalMarketPluginInstall.mock.calls[0]?.[0]).toEqual([
      'add',
      '--reporter=ndjson',
      '@liustack/modlens@3.18.1',
    ])
    expect(runExternalMarketPluginInstall.mock.calls[0]?.[1]).toBe('/private/dsh-invoking')

    await runtime.dispose()
  })

  it('keeps non-add operations on the ordinary managed command boundary', async () => {
    const runPlugin = vi.fn(() => completedHandle())
    const runExternalMarketPluginInstall = vi.fn(() => completedHandle())
    const createRuntime = await runtimeFactory()
    const runtime = createRuntime(
      { runPlugin, runExternalMarketPluginInstall },
      '/private/dsh-profile',
      '/private/dsh-invoking',
    )

    await expect(runtime.runPlugin('desktop', ['remove', '@liustack/modlens'])).resolves.toMatchObject({
      exitCode: 0,
      timedOut: false,
      cancelled: false,
    })
    expect(runPlugin).toHaveBeenCalledOnce()
    expect(runExternalMarketPluginInstall).not.toHaveBeenCalled()

    await runtime.dispose()
  })

  it('allows dshmarket itself to be upgraded through the external Market boundary', async () => {
    const runPlugin = vi.fn(() => completedHandle())
    const runExternalMarketPluginInstall = vi.fn(() => completedHandle())
    const createRuntime = await runtimeFactory()
    const runtime = createRuntime(
      { runPlugin, runExternalMarketPluginInstall },
      '/private/dsh-profile',
      '/private/dsh-invoking',
    )

    await expect(runtime.runPlugin('desktop', ['add', 'dshmarket@1.18.0'])).resolves.toMatchObject({
      exitCode: 0,
      timedOut: false,
      cancelled: false,
    })
    expect(runPlugin).not.toHaveBeenCalled()
    expect(runExternalMarketPluginInstall).toHaveBeenCalledWith(
      ['add', '--reporter=ndjson', 'dshmarket@1.18.0'],
      '/private/dsh-invoking',
      expect.any(AbortSignal),
    )
    await runtime.dispose()
  })
})
