import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  DESKTOP_INSTALL_RECOVERY_FILES,
  DESKTOP_INSTALL_RECOVERY_STATE_ENV,
  DesktopInstallRecoveryStore,
  desktopInstallRecoveryStatePath,
} from '../src/install-recovery.ts'

const roots: string[] = []
const PREINSTALL = {
  'package.json': '{"name":"fixture-private-marker","private":true}\n',
  'pnpm-lock.yaml': 'lockfileVersion: "9.0"\n# lock-private-marker\n',
  'pnpm-workspace.yaml': 'packages:\n  - fixture-private-marker\n',
} as const
const POSTINSTALL = {
  'package.json': '{"name":"fixture-private-marker","private":true,"dependencies":{"plugin-a":"1.0.0"}}\n',
  'pnpm-lock.yaml': 'lockfileVersion: "9.0"\n# installed-plugin-a\n',
  'pnpm-workspace.yaml': 'packages:\n  - fixture-private-marker\n  - installed-plugin-a\n',
} as const

interface Fixture {
  readonly root: string
  readonly profileDir: string
  readonly statePath: string
}

function temporaryRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'dsh-install-recovery-'))
  roots.push(root)
  return root
}

function fixture(files: readonly (keyof typeof PREINSTALL)[] = DESKTOP_INSTALL_RECOVERY_FILES): Fixture {
  const root = temporaryRoot()
  const profileDir = join(root, 'profiles', 'desktop')
  mkdirSync(profileDir, { recursive: true })
  for (const name of files) writeFileSync(join(profileDir, name), PREINSTALL[name], { mode: 0o640 })
  return {
    root,
    profileDir,
    statePath: desktopInstallRecoveryStatePath(join(root, 'user-data')),
  }
}

function store(target: Fixture, generationId = 'generation-0001'): DesktopInstallRecoveryStore {
  return new DesktopInstallRecoveryStore({
    statePath: target.statePath,
    profileName: 'desktop',
    profileDir: target.profileDir,
    generationId,
    now: () => 1_800_000_000_000,
  })
}

function begin(target: Fixture, generationId = 'generation-0001') {
  return store(target, generationId).begin({
    packageName: 'plugin-a',
    packageVersion: '1.0.0',
    receiptId: 'receipt-0001',
  })
}

function writePostinstall(target: Fixture): void {
  for (const name of DESKTOP_INSTALL_RECOVERY_FILES) {
    writeFileSync(join(target.profileDir, name), POSTINSTALL[name], { mode: 0o640 })
  }
}

function expectProfile(target: Fixture, expected: typeof PREINSTALL | typeof POSTINSTALL): void {
  for (const name of DESKTOP_INSTALL_RECOVERY_FILES) {
    expect(readFileSync(join(target.profileDir, name), 'utf8')).toBe(expected[name])
  }
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    try { chmodSync(root, 0o700) } catch {}
    rmSync(root, { recursive: true, force: true })
  }
})

describe('Desktop plugin install recovery state location', () => {
  it('uses the fixed private userData directory and accepts only its absolute terminal hand-off', () => {
    const root = temporaryRoot()
    const userData = join(root, 'user-data')
    const expected = join(userData, 'plugin-install-recovery', 'state.json')
    expect(desktopInstallRecoveryStatePath(userData)).toBe(expected)
    expect(desktopInstallRecoveryStatePath('/ignored', {
      [DESKTOP_INSTALL_RECOVERY_STATE_ENV]: expected,
    })).toBe(expected)
    expect(() => desktopInstallRecoveryStatePath('/ignored', {
      [DESKTOP_INSTALL_RECOVERY_STATE_ENV]: 'plugin-install-recovery/state.json',
    })).toThrow('must be an absolute path')
    expect(() => desktopInstallRecoveryStatePath('/ignored', {
      [DESKTOP_INSTALL_RECOVERY_STATE_ENV]: join(root, 'redirected', 'state.json'),
    })).toThrow('must use the fixed private directory')
  })
})

describe('Desktop plugin install recovery WAL', () => {
  it('publishes hash-only prepared metadata after private allowlisted preimages', async () => {
    const target = fixture()
    const transaction = await begin(target)

    expect(transaction.phase).toBe('prepared')
    expect(transaction.files.map(file => file.name)).toEqual(DESKTOP_INSTALL_RECOVERY_FILES)
    expect(transaction.files.every(file => file.before.present)).toBe(true)
    const stateText = readFileSync(target.statePath, 'utf8')
    expect(stateText).not.toContain('fixture-private-marker')
    expect(stateText).not.toContain('lock-private-marker')
    expect(stateText).not.toContain(target.profileDir)

    const backupDir = join(dirname(target.statePath), 'backups', transaction.transactionId)
    for (const name of DESKTOP_INSTALL_RECOVERY_FILES) {
      expect(readFileSync(join(backupDir, `${name}.before`), 'utf8')).toBe(PREINSTALL[name])
    }
    if (process.platform !== 'win32') {
      expect(lstatSync(dirname(target.statePath)).mode & 0o777).toBe(0o700)
      expect(lstatSync(dirname(backupDir)).mode & 0o777).toBe(0o700)
      expect(lstatSync(backupDir).mode & 0o777).toBe(0o700)
      expect(lstatSync(target.statePath).mode & 0o777).toBe(0o600)
      for (const name of DESKTOP_INSTALL_RECOVERY_FILES) {
        expect(lstatSync(join(backupDir, `${name}.before`)).mode & 0o777).toBe(0o600)
      }
    }
    await expect(begin(target)).rejects.toThrow('another plugin install recovery transaction is pending')
  })

  it('seals postimages, lets only the next generation claim verification, and clears healthy state', async () => {
    const target = fixture()
    const origin = store(target)
    const prepared = await origin.begin({
      packageName: 'plugin-a',
      packageVersion: '1.0.0',
      receiptId: 'receipt-0001',
    })
    writePostinstall(target)

    const sealed = await origin.seal(prepared.transactionId)
    expect(sealed.phase).toBe('awaiting-restart')
    expect(sealed.files.every(file => file.after?.present === true)).toBe(true)
    await expect(origin.claim()).resolves.toMatchObject({
      action: 'deferred',
      reason: 'origin-generation',
    })

    const restarted = store(target, 'generation-0002')
    const claimed = await restarted.claim()
    expect(claimed).toMatchObject({ action: 'verify' })
    if (claimed.action !== 'verify') throw new Error('expected verification claim')
    expect(claimed.transaction.phase).toBe('verifying')
    expect(claimed.transaction.verifyingGeneration).toBe('generation-0002')

    const verified = await restarted.markHealthy(prepared.transactionId)
    expect(verified.phase).toBe('verified')
    await restarted.clear(prepared.transactionId)
    expect(existsSync(target.statePath)).toBe(false)
    expect(existsSync(join(dirname(target.statePath), 'backups', prepared.transactionId))).toBe(false)
  })

  it('restores a mix of admitted pre- and postimages without overwriting unrelated paths', async () => {
    const target = fixture()
    const origin = store(target)
    const prepared = await origin.begin({
      packageName: 'plugin-a',
      packageVersion: '1.0.0',
      receiptId: 'receipt-0001',
    })
    writePostinstall(target)
    await origin.seal(prepared.transactionId)
    writeFileSync(join(target.profileDir, 'package.json'), PREINSTALL['package.json'], { mode: 0o640 })
    writeFileSync(join(target.profileDir, 'unrelated.txt'), 'preserve me\n')

    const restarted = store(target, 'generation-0002')
    await expect(restarted.claim()).resolves.toMatchObject({ action: 'verify' })
    const result = await restarted.restore(prepared.transactionId, 'startup-failed')

    expect(result.status).toBe('restored')
    expectProfile(target, PREINSTALL)
    expect(readFileSync(join(target.profileDir, 'unrelated.txt'), 'utf8')).toBe('preserve me\n')
    expect((await restarted.read())?.phase).toBe('rolled-back')
    await expect(restarted.restore(prepared.transactionId, 'startup-failed')).resolves.toMatchObject({
      status: 'already-restored',
    })
  })

  it('removes allowlisted files that were absent before installation', async () => {
    const target = fixture(['package.json'])
    const origin = store(target)
    const prepared = await origin.begin({
      packageName: 'plugin-a',
      packageVersion: '1.0.0',
      receiptId: 'receipt-0001',
    })
    writePostinstall(target)
    await origin.seal(prepared.transactionId)

    const restarted = store(target, 'generation-0002')
    await restarted.claim()
    await expect(restarted.restore(prepared.transactionId, 'startup-failed')).resolves.toMatchObject({
      status: 'restored',
    })
    expect(readFileSync(join(target.profileDir, 'package.json'), 'utf8')).toBe(PREINSTALL['package.json'])
    expect(existsSync(join(target.profileDir, 'pnpm-lock.yaml'))).toBe(false)
    expect(existsSync(join(target.profileDir, 'pnpm-workspace.yaml'))).toBe(false)
  })

  it('requires manual recovery on third-party drift and performs no partial rollback', async () => {
    const target = fixture()
    const origin = store(target)
    const prepared = await origin.begin({
      packageName: 'plugin-a',
      packageVersion: '1.0.0',
      receiptId: 'receipt-0001',
    })
    writePostinstall(target)
    await origin.seal(prepared.transactionId)
    writeFileSync(join(target.profileDir, 'package.json'), '{"external":"change"}\n', { mode: 0o640 })

    const restarted = store(target, 'generation-0002')
    await restarted.claim()
    const result = await restarted.restore(prepared.transactionId, 'startup-failed')

    expect(result).toMatchObject({
      status: 'manual-recovery-required',
      mismatchedFiles: ['package.json'],
      transaction: { phase: 'manual-recovery-required' },
    })
    expect(readFileSync(join(target.profileDir, 'package.json'), 'utf8')).toBe('{"external":"change"}\n')
    expect(readFileSync(join(target.profileDir, 'pnpm-lock.yaml'), 'utf8')).toBe(POSTINSTALL['pnpm-lock.yaml'])
    await expect(restarted.clear(prepared.transactionId)).rejects.toThrow('cannot be cleared')
  })

  it('rolls back an untouched interrupted prepare but refuses unknown unsealed writes', async () => {
    const untouched = fixture()
    const untouchedPrepared = await begin(untouched)
    const untouchedRestart = store(untouched, 'generation-0002')
    await expect(untouchedRestart.claim()).resolves.toMatchObject({
      action: 'restore',
      reason: 'interrupted-install',
    })
    await expect(untouchedRestart.restore(untouchedPrepared.transactionId, 'interrupted-install')).resolves.toMatchObject({
      status: 'restored',
    })

    const changed = fixture()
    const changedPrepared = await begin(changed)
    writeFileSync(join(changed.profileDir, 'package.json'), POSTINSTALL['package.json'], { mode: 0o640 })
    const changedRestart = store(changed, 'generation-0002')
    await expect(changedRestart.claim()).resolves.toMatchObject({
      action: 'restore',
      reason: 'interrupted-install',
    })
    await expect(changedRestart.restore(changedPrepared.transactionId, 'interrupted-install')).resolves.toMatchObject({
      status: 'manual-recovery-required',
      mismatchedFiles: ['package.json'],
    })
    expect(readFileSync(join(changed.profileDir, 'package.json'), 'utf8')).toBe(POSTINSTALL['package.json'])
  })

  it('can restore and clear a failed install in its origin generation before any postimage exists', async () => {
    const target = fixture()
    const origin = store(target)
    const prepared = await origin.begin({
      packageName: 'plugin-a',
      packageVersion: '1.0.0',
      receiptId: 'receipt-0001',
    })

    await expect(origin.restore(prepared.transactionId, 'install-failed')).resolves.toMatchObject({
      status: 'restored',
      transaction: { phase: 'rolled-back', failureReason: 'install-failed' },
    })
    await origin.clear(prepared.transactionId)
    expect(existsSync(target.statePath)).toBe(false)
  })
})

describe('Desktop plugin install recovery filesystem boundaries', () => {
  it('rejects symlinked and non-regular profile files', async () => {
    const linked = fixture([])
    const outside = join(linked.root, 'outside-package.json')
    writeFileSync(outside, PREINSTALL['package.json'])
    symlinkSync(outside, join(linked.profileDir, 'package.json'))
    await expect(begin(linked)).rejects.toThrow('only accepts regular files')

    const directory = fixture(['package.json'])
    mkdirSync(join(directory.profileDir, 'pnpm-lock.yaml'))
    await expect(begin(directory)).rejects.toThrow('only accepts regular files')
  })

  it('rejects oversized allowlisted files before publishing the WAL', async () => {
    const target = fixture(['package.json'])
    writeFileSync(join(target.profileDir, 'pnpm-workspace.yaml'), Buffer.alloc(1024 * 1024 + 1, 0x61))
    await expect(begin(target)).rejects.toThrow('file is too large')
    expect(existsSync(target.statePath)).toBe(false)
  })

  it('rejects a symlinked state file', async () => {
    const target = fixture()
    mkdirSync(dirname(target.statePath), { recursive: true })
    const outside = join(target.root, 'outside-state.json')
    writeFileSync(outside, '{}\n')
    symlinkSync(outside, target.statePath)
    await expect(store(target).read()).rejects.toThrow('state must be a regular file')
  })

  it('validates every backup before replacing any profile file', async () => {
    const target = fixture()
    const origin = store(target)
    const prepared = await origin.begin({
      packageName: 'plugin-a',
      packageVersion: '1.0.0',
      receiptId: 'receipt-0001',
    })
    writePostinstall(target)
    await origin.seal(prepared.transactionId)
    writeFileSync(
      join(dirname(target.statePath), 'backups', prepared.transactionId, 'package.json.before'),
      '{"tampered":true}\n',
    )

    const restarted = store(target, 'generation-0002')
    await restarted.claim()
    await expect(restarted.restore(prepared.transactionId, 'startup-failed')).rejects.toThrow(
      'backup for package.json is invalid',
    )
    expectProfile(target, POSTINSTALL)
    expect((await restarted.read())?.phase).toBe('verifying')
  })
})
