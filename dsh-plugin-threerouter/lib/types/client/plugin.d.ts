/**
 * Deepseek Harness for Threerouter image/video : isolated Client plugin.
 *
 * Registers the Threerouter-branded sidebar (replacing the upstream
 * SidebarRoot with priority -1) and the top-right account/balance/invite
 * overlay inside the advanced shell. Designed to compose alongside
 * `dsh-plugin-desktop` without depending on its client source — the desktop
 * shell owns the root frame, this plugin owns only the Threerouter surfaces.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
/** Services required by the Threerouter client surfaces. */
export declare const inject: string[];
/**
 * Register the Threerouter sidebar and auth overlay for the advanced shell.
 *
 * Stays inert outside the desktop advanced shell — the environment markers are
 * only injected by the Electron Host for advanced mode, so this plugin does
 * nothing in compatibility/extended mode or the upstream Web bundle.
 * @param ctx - browser Cordis context.
 */
export declare function apply(ctx: ClientContext): void;
