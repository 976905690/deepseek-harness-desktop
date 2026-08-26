/**
 * Remove an orphaned writer lock for the settings document at startup.
 *
 * `dsh-atomic-write` deliberately never deletes an existing `<file>.lock`,
 * since file age alone cannot prove that its owner stopped; orphan recovery is
 * an operator action. A stale `settings.yaml.lock` therefore blocks every later
 * persist of `settings.yaml` with a `timed out waiting for the writer lock`
 * error, which becomes a fatal exit when a plugin writes settings during use
 * (for example opening the Plugin Market). This startup guard removes the lock
 * only when it is provably abandoned: the recorded holder process is gone, or
 * the lock is old enough that a live holder is implausible. A lock held by a
 * live writer is left alone.
 */
import { existsSync, readFileSync, statSync, unlinkSync } from 'node:fs'
import type { DesktopLogger } from './desktop-logger.ts'

/**
 * Oldest age (ms) we accept for a lock whose recorded holder is still alive.
 * A live writer holds the lock only for its own read-modify-write, which is
 * immediate; a lock still older than this after that is not in active use.
 */
const LIVE_LOCK_MAX_AGE_MS = 60_000

/** Whether `pid` refers to a live process on this host. */
function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    // ESRCH means no such process; a permission error means it exists but is
    // not ours, which also counts as alive.
    return (error as NodeJS.ErrnoException).code !== 'ESRCH'
  }
}

/**
 * Clear an abandoned `settingsDocument.lock` left behind by a previous crashed
 * or hard-killed run. Never throws; failures are reported through the logger.
 */
export function clearStaleSettingsLock(settingsDocument: string, logger: DesktopLogger): void {
  const lockPath = `${settingsDocument}.lock`
  if (!existsSync(lockPath)) return
  try {
    const holderPid = Number.parseInt(readFileSync(lockPath, 'utf8').trim(), 10)
    const ageMs = Date.now() - statSync(lockPath).mtimeMs
    const heldByLiveProcess = Number.isInteger(holderPid) && holderPid > 0 && processIsAlive(holderPid)
    // A lock with a live, recent holder is in active use; leave it untouched.
    if (heldByLiveProcess && ageMs < LIVE_LOCK_MAX_AGE_MS) return
    unlinkSync(lockPath)
    logger.error(`dsh-plugin-desktop: cleared stale settings lock ${lockPath}`)
  } catch (cause) {
    logger.error(
      `dsh-plugin-desktop: could not clear settings lock ${lockPath}: ${cause instanceof Error ? cause.message : String(cause)}`,
    )
  }
}
