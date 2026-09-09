/** Persistence helpers for the desktop-managed dsh-image-video configuration. */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import * as yaml from 'js-yaml'
import { entryListSchema } from '@deepseek-ai/cordis-plugin-include'
import type { PatchOptions } from '@deepseek-ai/cordis-plugin-include'
import type {
  DesktopImageVideoConfigView,
  DesktopImageVideoCredentials,
  DesktopImageVideoProvider,
} from './desktop-settings-contract.ts'

const IMAGE_VIDEO_PATCH_ID = 'image-video'

/** Same defaults that the bundle's own `cordis.patch.yml` declares. */
const DEFAULT_IMAGE_VIDEO_CONFIG: DesktopImageVideoConfigView = Object.freeze({
  provider: 'threerouter',
  threerouter: Object.freeze({ apiKey: '', baseURL: '' }),
  wanx: Object.freeze({ apiKey: '', baseURL: '' }),
  seedance: Object.freeze({ apiKey: '', baseURL: '' }),
  defaultImageModel: '',
  defaultVideoModel: '',
  defaultImageSize: '1024*1024',
  defaultVideoDuration: 5,
  timeoutMs: 60_000,
  pollIntervalMs: 5_000,
  pollTimeoutMs: 300_000,
  retryTimes: 3,
  outputsDir: './outputs',
})

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function readCredentials(
  value: unknown,
  fallback: DesktopImageVideoCredentials,
): DesktopImageVideoCredentials {
  if (!isPlainObject(value)) return fallback
  return Object.freeze({
    apiKey: readString(value.apiKey, fallback.apiKey),
    baseURL: readString(value.baseURL, fallback.baseURL),
  })
}

function isImageVideoProvider(value: unknown): value is DesktopImageVideoProvider {
  return value === 'threerouter' || value === 'wanx' || value === 'seedance'
}

/** Project a single loader patch row's config into a renderer-safe view. */
export function projectImageVideoConfig(value: unknown): DesktopImageVideoConfigView {
  const config = isPlainObject(value) ? value : {}
  const fallback = DEFAULT_IMAGE_VIDEO_CONFIG
  const provider: DesktopImageVideoProvider = isImageVideoProvider(config.provider)
    ? config.provider
    : fallback.provider
  return Object.freeze({
    provider,
    threerouter: readCredentials(config.threerouter, fallback.threerouter),
    wanx: readCredentials(config.wanx, fallback.wanx),
    seedance: readCredentials(config.seedance, fallback.seedance),
    defaultImageModel: readString(config.defaultImageModel, fallback.defaultImageModel),
    defaultVideoModel: readString(config.defaultVideoModel, fallback.defaultVideoModel),
    defaultImageSize: readString(config.defaultImageSize, fallback.defaultImageSize),
    defaultVideoDuration: readNumber(config.defaultVideoDuration, fallback.defaultVideoDuration),
    timeoutMs: readNumber(config.timeoutMs, fallback.timeoutMs),
    pollIntervalMs: readNumber(config.pollIntervalMs, fallback.pollIntervalMs),
    pollTimeoutMs: readNumber(config.pollTimeoutMs, fallback.pollTimeoutMs),
    retryTimes: readNumber(config.retryTimes, fallback.retryTimes),
    outputsDir: readString(config.outputsDir, fallback.outputsDir),
  })
}

/**
 * Read the effective dsh-image-video configuration from a profile's `cordis.patch.yml`.
 * Returns the canonical default view when the file or its `image-video` row is absent.
 */
export function readImageVideoConfigFromPatchPath(patchPath: string): DesktopImageVideoConfigView {
  if (!existsSync(patchPath)) return DEFAULT_IMAGE_VIDEO_CONFIG
  let patches: PatchOptions[]
  try {
    const content = readFileSync(patchPath, 'utf8')
    const parsed = yaml.load(content, { schema: entryListSchema })
    if (!Array.isArray(parsed)) return DEFAULT_IMAGE_VIDEO_CONFIG
    patches = parsed as PatchOptions[]
  } catch {
    return DEFAULT_IMAGE_VIDEO_CONFIG
  }
  const row = patches.find(candidate => isPlainObject(candidate)
    && (candidate as { id?: unknown }).id === IMAGE_VIDEO_PATCH_ID)
  if (row === undefined) return DEFAULT_IMAGE_VIDEO_CONFIG
  const config = (row as { config?: unknown }).config
  return projectImageVideoConfig(config)
}

/** Render one config view back into the loader patch row's `config` field. */
function imageVideoConfigToRaw(
  value: DesktopImageVideoConfigView,
): Record<string, unknown> {
  return {
    provider: value.provider,
    threerouter: { apiKey: value.threerouter.apiKey, baseURL: value.threerouter.baseURL },
    wanx: { apiKey: value.wanx.apiKey, baseURL: value.wanx.baseURL },
    seedance: { apiKey: value.seedance.apiKey, baseURL: value.seedance.baseURL },
    defaultImageModel: value.defaultImageModel,
    defaultVideoModel: value.defaultVideoModel,
    defaultImageSize: value.defaultImageSize,
    defaultVideoDuration: value.defaultVideoDuration,
    timeoutMs: value.timeoutMs,
    pollIntervalMs: value.pollIntervalMs,
    pollTimeoutMs: value.pollTimeoutMs,
    retryTimes: value.retryTimes,
    outputsDir: value.outputsDir,
  }
}

/**
 * Persist one validated dsh-image-video configuration to a profile's `cordis.patch.yml`.
 * Existing rows are preserved; only the `image-video` row's `config` is rewritten.
 */
export function writeImageVideoConfigToPatchPath(
  patchPath: string,
  next: DesktopImageVideoConfigView,
): void {
  let patches: PatchOptions[]
  if (existsSync(patchPath)) {
    const content = readFileSync(patchPath, 'utf8')
    const parsed = yaml.load(content, { schema: entryListSchema })
    patches = Array.isArray(parsed) ? (parsed as PatchOptions[]) : []
  } else {
    patches = []
  }
  const rowIndex = patches.findIndex(candidate => isPlainObject(candidate)
    && (candidate as { id?: unknown }).id === IMAGE_VIDEO_PATCH_ID)
  const raw = imageVideoConfigToRaw(next)
  if (rowIndex >= 0) {
    const existing = patches[rowIndex] as Record<string, unknown>
    patches[rowIndex] = { ...existing, id: IMAGE_VIDEO_PATCH_ID, config: raw }
  } else {
    patches.push({ id: IMAGE_VIDEO_PATCH_ID, config: raw })
  }
  const dumped = yaml.dump(patches, { schema: entryListSchema, noRefs: true })
  const normalized = dumped.endsWith('\n') ? dumped : `${dumped}\n`
  writeFileSync(patchPath, normalized)
}

export const desktopImageVideoConfigConstants = Object.freeze({
  patchId: IMAGE_VIDEO_PATCH_ID,
  defaults: DEFAULT_IMAGE_VIDEO_CONFIG,
})