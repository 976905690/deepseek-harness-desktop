/** Profile-relative package resolution for Electron's restricted Node runtime. */

import { registerHooks } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { unpackedAsarPath } from './packaged-runtime-path.ts'
import {
  packageNameFromSpecifier,
  resolveOverlayPackage,
} from './package-overlay.ts'

const LOADER_ENTRY_URL = import.meta.resolve('@deepseek-ai/cordis-plugin-loader')
const DESKTOP_ENTRY_URL = pathToFileURL(
  unpackedAsarPath(fileURLToPath(new URL('../lib/index.js', import.meta.url))),
).href
const DESKTOP_PACKAGE_URL = pathToFileURL(
  unpackedAsarPath(fileURLToPath(new URL('../package.json', import.meta.url))),
).href

/** Return whether a Loader request needs Node package resolution. */
function isBareSpecifier(specifier: string): boolean {
  return !specifier.startsWith('.') && !specifier.startsWith('/') && !URL.canParse(specifier)
}

/**
 * Resolve Cordis Loader bare imports from the selected persistent profile.
 * @param profileBaseUrl - file URL inside the profile that owns plugin dependencies.
 * @returns an idempotent hook disposer.
 */
export function installProfilePackageResolver(profileBaseUrl: string): () => void {
  // Track the module graph rooted at every overlay-selected Loader package.
  const overlayModuleUrls = new Set<string>()
  const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
      const fromLoader = context.parentURL === LOADER_ENTRY_URL
      const packageName = fromLoader ? packageNameFromSpecifier(specifier) : undefined
      if (packageName !== undefined) {
        const overlay = resolveOverlayPackage(packageName, {
          installPackageUrl: DESKTOP_PACKAGE_URL,
          profilePackageUrl: profileBaseUrl,
        })
        const resolved = nextResolve(specifier, {
          ...context,
          parentURL: overlay.selected.source === 'profile' ? profileBaseUrl : DESKTOP_ENTRY_URL,
        })
        overlayModuleUrls.add(resolved.url)
        return resolved
      }
      if (context.parentURL === undefined || !overlayModuleUrls.has(context.parentURL)) {
        return nextResolve(specifier, context)
      }
      if (!isBareSpecifier(specifier)) {
        const resolved = nextResolve(specifier, context)
        if (specifier.startsWith('.')) overlayModuleUrls.add(resolved.url)
        return resolved
      }
      try {
        const resolved = nextResolve(specifier, context)
        overlayModuleUrls.add(resolved.url)
        return resolved
      } catch (cause) {
        if ((cause as NodeJS.ErrnoException).code !== 'ERR_MODULE_NOT_FOUND') throw cause
        const resolved = nextResolve(specifier, { ...context, parentURL: profileBaseUrl })
        overlayModuleUrls.add(resolved.url)
        return resolved
      }
    },
  })
  let active = true
  return () => {
    if (!active) return
    active = false
    hooks.deregister()
  }
}
