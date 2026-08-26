import { mkdtempSync, writeFileSync, utimesSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { clearStaleSettingsLock } from '../src/settings-lock.ts'

function fixedLogger() {
  return { error: vi.fn(), errorCause: vi.fn() }
}

describe('clearStaleSettingsLock', () => {
  it('is a no-op when no lock exists', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-lock-'))
    const settings = join(dir, 'settings.yaml')
    const logger = fixedLogger()
    clearStaleSettingsLock(settings, logger)
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('keeps a lock whose recorded holder is live and recent', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-lock-'))
    const settings = join(dir, 'settings.yaml')
    const lock = `${settings}.lock`
    writeFileSync(lock, `${process.pid}\n`)
    const logger = fixedLogger()
    clearStaleSettingsLock(settings, logger)
    expect(existsSync(lock)).toBe(true)
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('removes a lock written by a non-numeric (orphan) holder', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-lock-'))
    const settings = join(dir, 'settings.yaml')
    const lock = `${settings}.lock`
    writeFileSync(lock, 'not-a-pid\n')
    const logger = fixedLogger()
    clearStaleSettingsLock(settings, logger)
    expect(existsSync(lock)).toBe(false)
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('cleared stale settings lock'))
  })

  it('removes an old lock even when its recorded pid has been recycled into a live one', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-lock-'))
    const settings = join(dir, 'settings.yaml')
    const lock = `${settings}.lock`
    writeFileSync(lock, `${process.pid}\n`)
    const old = new Date(Date.now() - 2 * 60_000)
    utimesSync(lock, old, old)
    const logger = fixedLogger()
    clearStaleSettingsLock(settings, logger)
    expect(existsSync(lock)).toBe(false)
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('cleared stale settings lock'))
  })
})
