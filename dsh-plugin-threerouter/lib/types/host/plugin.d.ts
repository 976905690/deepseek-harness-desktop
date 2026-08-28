/**
 * Deepseek Harness for Threerouter : isolated Host plugin.
 *
 * Owns the `/threerouter-auth` RPC channel (login, profile, API key
 * provisioning, model routing, invite link, logout). Designed to compose
 * alongside `dsh-plugin-desktop` without touching its source — register it as
 * a standalone entry in `cordis.patch.yml`.
 */
import type { Context } from '@deepseek-ai/cordis';
/** Stable Cordis plugin name (referenced by cordis.patch.yml entry id). */
export declare const name = "threerouter-integration";
/**
 * Services required before the Threerouter RPC can register. `connection`
 * carries the `rpc.handle()` seam; the rest (credentials / settings /
 * agentDefaultModel) are probed at runtime by the auth handler so this plugin
 * stays inert in profiles that do not wire them.
 */
export declare const inject: string[];
/**
 * Register the Threerouter auth RPC handler on the loopback connection.
 * @param ctx - Host context carrying the loopback connection service.
 */
export declare function apply(ctx: Context): void;
