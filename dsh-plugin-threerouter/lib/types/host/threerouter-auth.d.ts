/**
 * Deepseek Harness for Threerouter image/video : Threerouter user authentication, API key auto-provisioning,
 * balance display, and invite link sharing.
 *
 * Host-side implementation (RPC server for client → host calls).
 */
import type { Context } from '@deepseek-ai/cordis';
import type { ConnectionRpcHandler } from '@deepseek-ai/dsh-client-connection';
export declare const THREEROUTER_BASE_URL = "https://www.threerouter.com";
export declare const THREEROUTER_OPENAI_BASE = "https://www.threerouter.com/v1";
export declare const THREEROUTER_API_KEY_ENV = "THREEROUTER_API_KEY";
export declare const THREEROUTER_PROVIDER = "threerouter";
export declare const THREEROUTER_DEFAULT_MODEL = "deepseek-v4-pro";
/** Login request from client → host. */
export interface ThreerouterLoginRequest {
    email: string;
    password: string;
    turnstileToken?: string;
}
/** API key returned from Threerouter backend. */
export interface ThreerouterApiKey {
    id: number;
    key: string;
    name: string;
    status: string;
}
/** Authenticated user profile (camelCase, used in RPC responses). */
export interface ThreerouterUserProfile {
    id: number;
    email: string;
    username: string;
    role: string;
    balance: number;
    allowedGroups: number[];
    apiKeys: ThreerouterApiKey[];
}
/** Login response from host → client. */
export interface ThreerouterLoginResponse {
    success: true;
    accessToken: string;
    apiKey: string | null;
    profile: ThreerouterUserProfile;
    affCode: string;
}
/** Get current user info request. */
export interface ThreerouterGetProfileRequest {
}
/** Current user info response. */
export interface ThreerouterProfileResponse {
    profile: ThreerouterUserProfile;
    balance: number;
    affCode: string;
    hasApiKey: boolean;
}
/** Copy invite link to clipboard request. */
export interface ThreerouterCopyInviteRequest {
}
/** Copy invite link response. */
export interface ThreerouterCopyInviteResponse {
    link: string;
    copied: true;
}
/** Logout request. */
export interface ThreerouterLogoutRequest {
}
/** Logout response. */
export interface ThreerouterLogoutResponse {
    success: true;
}
/** Get available models from Threerouter. */
export interface ThreerouterGetModelsRequest {
}
/** Available models response. */
export interface ThreerouterModelInfo {
    id: string;
    name: string;
    supported: boolean;
}
export interface ThreerouterGetModelsResponse {
    models: ThreerouterModelInfo[];
    defaultModel: string;
}
/** Stored session state on the host. */
export interface ThreerouterStoredState {
    accessToken: string;
    refreshToken: string;
    profile: ThreerouterUserProfile;
    affCode: string;
    apiKey: string;
}
/**
 * Factory: create the Threerouter Auth RPC endpoint handler and wiring
 * that performs auto-API-key creation/provisioning and pushes the
 * configured API key into ctx.credentials and the llm-pi-ai catalog.
 */
export declare function createThreerouterAuthHandler(ctx: Context): {
    handler: ConnectionRpcHandler;
    getStoredState: () => ThreerouterStoredState | null;
};
