import { credentialRef } from "@deepseek-ai/dsh-credentials";
import { settingsNamespace } from "@deepseek-ai/dsh-settings";
//#region src/host/threerouter-auth.ts
const THREEROUTER_BASE_URL = "https://www.threerouter.com";
const THREEROUTER_OPENAI_BASE = `${THREEROUTER_BASE_URL}/v1`;
const THREEROUTER_API_KEY_ENV = "THREEROUTER_API_KEY";
const THREEROUTER_API_KEY_REF = credentialRef(THREEROUTER_API_KEY_ENV);
const THREEROUTER_PROVIDER = "threerouter";
const THREEROUTER_DEFAULT_MODEL = "deepseek-v4-pro";
const LLM_PI_AI_NS = settingsNamespace("llm-pi-ai");
const AGENT_DEFAULT_MODEL_NS = settingsNamespace("agent-default-model");
/**
* Lightweight payload guards for the RPC endpoints (the caller is our own
* client, so structural checks suffice — no schema library is required).
*/
function isRecord(value) {
	return typeof value === "object" && value !== null;
}
function asLoginRequest(payload) {
	if (!isRecord(payload) || typeof payload.email !== "string" || typeof payload.password !== "string") throw new Error("Invalid login request: email and password are required");
	return {
		email: payload.email,
		password: payload.password,
		...typeof payload.turnstileToken === "string" ? { turnstileToken: payload.turnstileToken } : {}
	};
}
function asEmptyRequest(payload) {
	if (!isRecord(payload) && payload !== void 0) throw new Error("Invalid request payload");
}
/**
* Map a raw API key (snake_case) to the camelCase RPC type.
*/
function mapApiKey(raw) {
	return {
		id: raw.id,
		key: raw.key,
		name: raw.name,
		status: raw.status
	};
}
/**
* Map a raw user (snake_case) to the camelCase RPC type.
*/
function mapUser(raw) {
	return {
		id: raw.id,
		email: raw.email,
		username: raw.username,
		role: raw.role,
		balance: raw.balance,
		allowedGroups: raw.allowed_groups ?? [],
		apiKeys: (raw.api_keys ?? []).map(mapApiKey)
	};
}
/**
* Factory: create the Threerouter Auth RPC endpoint handler and wiring
* that performs auto-API-key creation/provisioning and pushes the
* configured API key into ctx.credentials and the llm-pi-ai catalog.
*/
function createThreerouterAuthHandler(ctx) {
	let storedState = null;
	/**
	* Make an authenticated request to Threerouter backend.
	* Returns the unwrapped `data` field from the standard response envelope.
	*/
	async function threerouterRequest(path, method = "GET", body) {
		const headers = { "Content-Type": "application/json" };
		if (storedState?.accessToken) headers.Authorization = `Bearer ${storedState.accessToken}`;
		const url = `${THREEROUTER_BASE_URL}/api/v1${path}`;
		const options = {
			method,
			headers,
			...body === void 0 ? {} : { body: JSON.stringify(body) }
		};
		const resp = await fetch(url, options);
		if (!resp.ok) {
			const text = await resp.text();
			throw new Error(`Threerouter API ${method} ${path} failed: ${resp.status} ${text}`);
		}
		const envelope = await resp.json();
		if (envelope.code !== 0) throw new Error(`Threerouter API error: ${envelope.message}`);
		return envelope.data;
	}
	/**
	* Ensure the user has at least one API key, create one if none exists.
	* Returns the first active API key on success.
	*/
	async function ensureApiKeyExists() {
		const envelope = await threerouterRequest("/keys");
		const activeKey = (Array.isArray(envelope?.items) ? envelope.items : []).find((k) => k.status === "active" && k.group_id !== null && k.group_id !== void 0);
		if (activeKey) {
			ctx.logger.info(`threerouter-auth: found existing active API key "${activeKey.name}" (id=${activeKey.id})`);
			return activeKey.key;
		}
		ctx.logger.info("threerouter-auth: no active API key found, creating new...");
		const groupId = storedState?.profile.allowedGroups[0];
		const newKey = await threerouterRequest("/keys", "POST", {
			name: "Deepseek Harness for Threerouter image/video  Desktop",
			...groupId === void 0 ? {} : { group_id: groupId }
		});
		ctx.logger.info(`threerouter-auth: created new API key "${newKey.name}" (id=${newKey.id})`);
		return newKey.group_id === null || newKey.group_id === void 0 ? null : newKey.key;
	}
	/**
	* Fetch user profile + affiliate code.
	*/
	async function fetchProfileAndAffiliate() {
		const [userResp, affResp] = await Promise.all([threerouterRequest("/auth/me"), threerouterRequest("/user/aff")]);
		return {
			profile: mapUser(userResp),
			affCode: affResp.aff_code
		};
	}
	/**
	* Inject the API key into the credentials store for llm-pi-ai to pick up.
	* Must be awaited so the async file write completes before the first LLM
	* request resolves the credential.
	*/
	async function injectApiKeyToCredentials(apiKey) {
		const credentials = ctx.get("credentials");
		if (credentials !== void 0) await credentials.set(THREEROUTER_API_KEY_REF, apiKey);
		ctx.logger.info("threerouter-auth: injected API key into credentials", { env: THREEROUTER_API_KEY_ENV });
	}
	/**
	* The fallback model list used when the /v1/models endpoint is unreachable.
	*/
	function fallbackModels() {
		return [
			{
				id: "deepseek-v4-pro",
				name: "DeepSeek V4 Pro",
				supported: true
			},
			{
				id: "deepseek-v4-flash",
				name: "DeepSeek V4 Flash",
				supported: true
			},
			{
				id: "deepseek-v3",
				name: "DeepSeek V3",
				supported: true
			},
			{
				id: "gpt-4o",
				name: "GPT-4o",
				supported: true
			},
			{
				id: "gpt-4o-mini",
				name: "GPT-4o Mini",
				supported: true
			},
			{
				id: "claude-3-5-sonnet-latest",
				name: "Claude 3.5 Sonnet",
				supported: true
			},
			{
				id: "claude-3-opus-latest",
				name: "Claude 3 Opus",
				supported: true
			},
			{
				id: "gemini-1.5-pro",
				name: "Gemini 1.5 Pro",
				supported: true
			}
		];
	}
	/**
	* Query the OpenAI-compatible /v1/models endpoint for the models this API key
	* can use, falling back to a static list when the endpoint is unreachable.
	*/
	async function fetchSupportedModels(apiKey) {
		try {
			const modelsResp = await fetch(`${THREEROUTER_OPENAI_BASE}/models`, apiKey ? { headers: { Authorization: `Bearer ${apiKey}` } } : void 0);
			if (!modelsResp.ok) throw new Error(`Failed to fetch models: ${modelsResp.status}`);
			const models = (await modelsResp.json()).data.filter((m) => m.object === "model").map((m) => ({
				id: m.id,
				name: m.id,
				supported: true
			}));
			return models.length > 0 ? models : fallbackModels();
		} catch (error) {
			ctx.logger.warn("threerouter-auth: failed to fetch models from API, using fallback list", error);
			return fallbackModels();
		}
	}
	/**
	* Register the Threerouter provider route into the llm-pi-ai catalog and set
	* the default Agent model, so the models this API key supports appear in the
	* picker and new sessions default to deepseek-v4-pro.
	*/
	async function configureModelRoutes(apiKey) {
		const settings = ctx.get("settings");
		if (settings === void 0) {
			ctx.logger.warn("threerouter-auth: no settings service, model routes not registered");
			return;
		}
		const models = await fetchSupportedModels(apiKey);
		const providerProfile = {
			apiKeyEnv: THREEROUTER_API_KEY_ENV,
			displayName: "Threerouter",
			api: "openai-completions",
			baseURL: THREEROUTER_OPENAI_BASE,
			models: models.map((m) => ({
				id: m.id,
				name: m.name ?? m.id,
				contextWindow: 131072,
				maxTokens: 16384,
				input: ["text"]
			})),
			defaultContextWindow: 131072,
			defaultMaxTokens: 16384,
			defaultInput: ["text"]
		};
		try {
			await settings.mutate(LLM_PI_AI_NS, [{
				op: "set",
				path: ["providers", THREEROUTER_PROVIDER],
				value: providerProfile
			}]);
			ctx.logger.info(`threerouter-auth: settings.mutate wrote ${models.length} model(s) under provider "${THREEROUTER_PROVIDER}"`);
		} catch (error) {
			ctx.logger.warn(`threerouter-auth: settings.mutate refused the provider "${THREEROUTER_PROVIDER}" profile — llm-pi-ai onChange will NOT register this route. Inspect the caught error for schema fields.`);
			ctx.logger.warn(error);
		}
		const agentDefaultModel = ctx.get("agentDefaultModel");
		if (agentDefaultModel !== void 0) try {
			await agentDefaultModel.saveSelection({
				provider: THREEROUTER_PROVIDER,
				model: THREEROUTER_DEFAULT_MODEL
			});
		} catch (error) {
			ctx.logger.warn("threerouter-auth: agentDefaultModel.saveSelection failed (non-fatal)", error);
		}
	}
	/**
	* Remove the Threerouter provider route and reset the default model when the
	* user signs out, so no session is left pointing at an unavailable provider.
	*/
	async function clearModelConfiguration() {
		const settings = ctx.get("settings");
		if (settings !== void 0) {
			await settings.mutate(LLM_PI_AI_NS, [{
				op: "unset",
				path: ["providers", THREEROUTER_PROVIDER]
			}]);
			await settings.replace(AGENT_DEFAULT_MODEL_NS, {});
		}
		ctx.logger.info("threerouter-auth: cleared Threerouter model routes and default model");
	}
	/**
	* Handler entry point called by RPC.
	*
	* All cases are wrapped in try-catch so that API errors are returned as
	* structured RPC error responses ({ ok: false, error }) instead of
	* propagating as uncaught HTTP 500s.
	*/
	const handler = async (endpoint, payload, signal) => {
		try {
			switch (endpoint) {
				case "login": {
					const { email, password, turnstileToken } = asLoginRequest(payload);
					ctx.logger.info(`threerouter-auth: login attempt for ${email}`);
					const loginData = await threerouterRequest("/auth/login", "POST", {
						email,
						password,
						turnstile_token: turnstileToken
					});
					storedState = {
						accessToken: loginData.access_token,
						refreshToken: loginData.refresh_token || "",
						profile: mapUser(loginData.user),
						affCode: "",
						apiKey: ""
					};
					const { profile, affCode } = await fetchProfileAndAffiliate();
					storedState.profile = profile;
					storedState.affCode = affCode;
					let apiKey = null;
					try {
						apiKey = await ensureApiKeyExists();
						if (apiKey) {
							storedState.apiKey = apiKey;
							await injectApiKeyToCredentials(apiKey);
							await configureModelRoutes(apiKey);
						}
					} catch (apiKeyError) {
						ctx.logger.warn("threerouter-auth: API key provisioning failed (non-fatal)", apiKeyError);
					}
					ctx.logger.info(`threerouter-auth: login successful for ${email}`);
					return {
						ok: true,
						value: {
							success: true,
							accessToken: storedState.accessToken,
							apiKey,
							profile,
							affCode
						}
					};
				}
				case "getProfile": {
					asEmptyRequest(payload);
					if (!storedState) throw new Error("Not authenticated");
					const { profile, affCode } = await fetchProfileAndAffiliate();
					storedState.profile = profile;
					storedState.affCode = affCode;
					return {
						ok: true,
						value: {
							profile,
							balance: profile.balance,
							affCode,
							hasApiKey: !!storedState.apiKey
						}
					};
				}
				case "copyInviteLink":
					asEmptyRequest(payload);
					if (!storedState?.affCode) throw new Error("No affiliate code available");
					return {
						ok: true,
						value: {
							link: `${THREEROUTER_BASE_URL}/register?aff=${encodeURIComponent(storedState.affCode)}`,
							copied: true
						}
					};
				case "logout": {
					asEmptyRequest(payload);
					storedState = null;
					const credentials = ctx.get("credentials");
					if (credentials !== void 0) await credentials.set(THREEROUTER_API_KEY_REF, "");
					await clearModelConfiguration();
					return {
						ok: true,
						value: { success: true }
					};
				}
				case "getModels": {
					asEmptyRequest(payload);
					if (!storedState) throw new Error("Not authenticated");
					const models = storedState.apiKey ? await fetchSupportedModels(storedState.apiKey) : fallbackModels();
					const defaultModel = THREEROUTER_DEFAULT_MODEL;
					return {
						ok: true,
						value: {
							models: models.sort((a, b) => {
								if (a.id === defaultModel) return -1;
								if (b.id === defaultModel) return 1;
								if (a.id.startsWith("deepseek-v4")) return -1;
								return a.id.localeCompare(b.id);
							}),
							defaultModel
						}
					};
				}
				default: throw new Error(`Unknown endpoint: ${endpoint}`);
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			ctx.logger.error(`threerouter-auth: RPC "${endpoint}" failed: ${message}`);
			return {
				ok: false,
				error: {
					code: "internal",
					message,
					details: {}
				}
			};
		}
	};
	return {
		handler,
		getStoredState: () => storedState
	};
}
//#endregion
//#region src/host/plugin.ts
/** Stable Cordis plugin name (referenced by cordis.patch.yml entry id). */
const name = "threerouter-integration";
/**
* Services required before the Threerouter RPC can register. `connection`
* carries the `rpc.handle()` seam; the rest (credentials / settings /
* agentDefaultModel) are probed at runtime by the auth handler so this plugin
* stays inert in profiles that do not wire them.
*/
const inject = ["connection"];
/**
* Register the Threerouter auth RPC handler on the loopback connection.
* @param ctx - Host context carrying the loopback connection service.
*/
function apply(ctx) {
	ctx.effect(() => {
		const authHandler = createThreerouterAuthHandler(ctx);
		const removeRpc = ctx.get("connection").rpc.handle("/threerouter-auth", authHandler.handler, { authority: "loopback" });
		return () => {
			removeRpc();
		};
	}, "threerouter-auth: register RPC handler");
}
//#endregion
export { apply, inject, name };

//# sourceMappingURL=plugin.js.map