import {
  canonicalize,
  defineEndpointPackage,
  wakeAfter,
} from "@hypit/hypit/endpoint-kit";
import type {
  AsyncEndpoint,
  CredentialRef,
  EndpointCredential,
  EndpointInvocationContext,
  EndpointOutcome,
  EndpointRequest,
} from "@hypit/hypit/endpoint-kit";
import { generationTypes, sealGeneratedVideoSet } from "@hypit/hypit/generation";
import type { GenerationRequest } from "@hypit/hypit/generation";
import type { BlobRef, CanonicalValue, CapabilityRef } from "@hypit/hypit/endpoint-kit";

export const providerModule = { name: "@local/hypit-provider-threerouter", version: "1" } as const;
export const wan3VideoCapability = {
  module: { name: "@local/wan3-video", version: "1" },
  name: "wan3.0-video",
} as const;
export const minimaxH3Capability = {
  module: { name: "@local/minimax-h3", version: "1" },
  name: "MiniMax-H3",
} as const;

const DEFAULT_BASE_URL = "https://api.threerouter.com/v1";
const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 600_000;
const DEFAULT_OPERATION_TIMEOUT_MS = 30 * 60_000;
const DEFAULT_ASSET_UPLOAD_URL = "https://tmpfiles.org/api/v1/upload";

/**
 * Temporary public hosts tried in order when a local artifact has to become a
 * URL the upstream model can fetch. ThreeRouter itself has no upload endpoint,
 * so the Provider bridges the file through whichever host answers first.
 */
const ASSET_UPLOAD_HOSTS: readonly {
  readonly name: string;
  readonly upload: (blob: Blob, filename: string) => Promise<string>;
}[] = [
  {
    name: "tmpfiles.org",
    async upload(blob, filename) {
      const form = new FormData();
      form.append("file", blob, filename);
      const response = await fetch(DEFAULT_ASSET_UPLOAD_URL, {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(60_000),
      });
      const responseText = await response.text();
      assert(response.ok, `tmpfiles.org upload returned HTTP ${response.status}: ${responseText.slice(0, 300)}`);
      let parsed: unknown;
      try { parsed = JSON.parse(responseText); } catch { throw new Error("tmpfiles.org upload returned invalid JSON"); }
      const body = object(parsed, "tmpfiles.org upload response");
      const data = body.data !== null && typeof body.data === "object" && !Array.isArray(body.data)
        ? body.data as JsonObject
        : undefined;
      const uploaded = optionalText(data?.url);
      assert(uploaded !== undefined, "tmpfiles.org upload response has no URL");
      return uploaded.replace(/^https:\/\/tmpfiles\.org\//u, "https://tmpfiles.org/dl/");
    },
  },
  {
    name: "catbox.moe",
    async upload(blob, filename) {
      const form = new FormData();
      form.append("reqtype", "fileupload");
      form.append("fileToUpload", blob, filename);
      const response = await fetch("https://catbox.moe/user/api.php", {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(60_000),
      });
      const responseText = (await response.text()).trim();
      assert(response.ok && responseText.startsWith("https://"), `catbox.moe upload returned HTTP ${response.status}: ${responseText.slice(0, 300)}`);
      return responseText;
    },
  },
  {
    name: "litterbox.catbox.moe",
    async upload(blob, filename) {
      const form = new FormData();
      form.append("reqtype", "fileupload");
      form.append("time", "1h");
      form.append("fileToUpload", blob, filename);
      const response = await fetch("https://litterbox.catbox.moe/resources/internals/api.php", {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(60_000),
      });
      const responseText = (await response.text()).trim();
      assert(response.ok && responseText.startsWith("https://"), `litterbox upload returned HTTP ${response.status}: ${responseText.slice(0, 300)}`);
      return responseText;
    },
  },
  {
    name: "uguu.se",
    async upload(blob, filename) {
      const form = new FormData();
      form.append("files[]", blob, filename);
      const response = await fetch("https://uguu.se/upload", {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(60_000),
      });
      const responseText = await response.text();
      assert(response.ok, `uguu.se upload returned HTTP ${response.status}: ${responseText.slice(0, 300)}`);
      let parsed: unknown;
      try { parsed = JSON.parse(responseText); } catch { throw new Error("uguu.se upload returned invalid JSON"); }
      const body = object(parsed, "uguu.se upload response");
      const files = Array.isArray(body.files) ? body.files : [];
      const first = files.length > 0 && typeof files[0] === "object" && files[0] !== null
        ? files[0] as JsonObject
        : undefined;
      const uploaded = optionalText(first?.url) ?? optionalText(body.url);
      assert(uploaded !== undefined, "uguu.se upload response has no URL");
      return uploaded;
    },
  },
  {
    name: "0x0.st",
    async upload(blob, filename) {
      const form = new FormData();
      form.append("file", blob, filename);
      const response = await fetch("https://0x0.st", {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(60_000),
      });
      const responseText = (await response.text()).trim();
      assert(response.ok && responseText.startsWith("https://"), `0x0.st upload returned HTTP ${response.status}: ${responseText.slice(0, 300)}`);
      return responseText;
    },
  },
];

type JsonObject = Record<string, unknown>;

export type CreateThreeRouterProviderOptions = {
  readonly instance: string;
  readonly pool: string;
  readonly baseUrl?: string;
  readonly apiKey: CredentialRef;
  readonly defaultConcurrency?: number;
  readonly pollIntervalMs?: number;
  readonly requestTimeoutMs?: number;
  readonly operationTimeoutMs?: number;
  readonly fetch?: typeof globalThis.fetch;
  /**
   * Publish an admitted Resource at a URL ThreeRouter can fetch. ThreeRouter's
   * generation endpoint takes each `media[]` entry as a URL, not a multipart
   * upload. When this resolver is absent the Provider inlines the admitted
   * bytes as a data URI, which the gateway forwards to the upstream model.
   */
  readonly publicAssetUrl?: (
    artifact: BlobRef,
    resources: EndpointInvocationContext["resources"],
  ) => Promise<string>;
  /**
   * When true (the default), admitted local media is published to a temporary
   * public URL before the ThreeRouter request. Hosted video models cannot
   * dereference local data URIs. Set false only for gateways that accept data.
   */
  readonly publishLocalAssets?: boolean;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function object(value: unknown, subject: string): JsonObject {
  assert(value !== null && typeof value === "object" && !Array.isArray(value), `${subject} must be an object`);
  return value as JsonObject;
}

function text(value: unknown, subject: string): string {
  assert(typeof value === "string" && value.trim().length > 0, `${subject} must be a non-empty string`);
  return value;
}

function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function url(value: unknown, subject: string): string {
  const parsed = new URL(text(value, subject));
  assert(parsed.protocol === "https:" || (parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname)),
    `${subject} must use HTTPS or loopback HTTP`);
  return parsed.href;
}

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Encode admitted bytes for a `data:` URL without depending on a host runtime global. */
function base64(bytes: Uint8Array): string {
  let encoded = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index]!;
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    encoded += BASE64_ALPHABET[first >> 2];
    encoded += BASE64_ALPHABET[((first & 3) << 4) | ((second ?? 0) >> 4)];
    encoded += second === undefined ? "=" : BASE64_ALPHABET[((second & 15) << 2) | ((third ?? 0) >> 6)];
    encoded += third === undefined ? "=" : BASE64_ALPHABET[third & 63];
  }
  return encoded;
}

function serviceBaseUrl(value: string | undefined): string {
  const raw = (value ?? DEFAULT_BASE_URL).trim().replace(/\/+$/u, "");
  assert(raw.length > 0, "ThreeRouter baseUrl is empty");
  const parsed = new URL(raw);
  assert(parsed.protocol === "https:" || (parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname)),
    "ThreeRouter baseUrl must use HTTPS or loopback HTTP");
  return raw;
}

function mediaExtension(mediaType: string): string {
  switch (mediaType.toLowerCase()) {
    case "video/mp4": return "mp4";
    case "video/webm": return "webm";
    case "image/jpeg": return "jpg";
    case "image/png": return "png";
    case "image/webp": return "webp";
    case "audio/mpeg": return "mp3";
    case "audio/mp4": return "m4a";
    case "audio/wav": return "wav";
    default: return "bin";
  }
}

/**
 * ThreeRouter forwards reference media URLs to the selected upstream model.
 * MiniMax-H3, like most hosted video models, cannot fetch a local data URI.
 * This bridge publishes one admitted artifact through a temporary public file
 * host so the Provider can keep using ThreeRouter's native media contract.
 */
async function uploadPublicAsset(
  artifact: BlobRef,
  resources: EndpointInvocationContext["resources"],
): Promise<string> {
  const bytes = await resources.get(artifact.resource);
  assert(bytes !== undefined, `ThreeRouter resource ${artifact.resource} is unavailable`);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const filename = `hypit-${artifact.resource}.${mediaExtension(artifact.mediaType)}`;
  const blob = new Blob([copy.buffer], { type: artifact.mediaType });
  const failures: string[] = [];
  for (const host of ASSET_UPLOAD_HOSTS) {
    try {
      return url(await host.upload(blob, filename), `${host.name} uploaded asset URL`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      failures.push(`${host.name}: ${reason}`);
    }
  }
  throw new Error(`every public asset host failed; ${failures.join("; ")}`);
}

function publicFailure(value: unknown): { code: string; message: string } | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  const body = value as JsonObject;
  const nested = body.error;
  if (typeof nested === "string" && nested.trim().length > 0) {
    return {
      code: optionalText(body.code) ?? optionalText(body.type) ?? "THREEROUTER_ERROR",
      message: nested.replace(/https?:\/\/\S+/giu, "[redacted-url]"),
    };
  }
  const source = nested !== null && typeof nested === "object" && !Array.isArray(nested)
    ? nested as JsonObject
    : body;
  const code = optionalText(source.code) ?? optionalText(source.type) ?? "THREEROUTER_ERROR";
  const message = optionalText(source.message) ?? optionalText(source.reason)
    ?? optionalText(body.error_message) ?? optionalText(body.error);
  return message === undefined ? undefined : { code, message: message.replace(/https?:\/\/\S+/giu, "[redacted-url]") };
}

function apiKey(credentials: Readonly<Record<string, EndpointCredential>>): string {
  const credential = credentials.apiKey;
  assert(credential !== undefined && credential.secret.trim().length > 0, "ThreeRouter apiKey is unavailable");
  return credential.secret;
}

function scalar(request: GenerationRequest, port: string): string | number | boolean | undefined {
  const value = request.ports[port]?.[0];
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? value : undefined;
}

function mediaItems(request: GenerationRequest, port: string): readonly import("@hypit/hypit/generation").GenerationMediaValue[] {
  return (request.ports[port] ?? []).filter(
    (value): value is import("@hypit/hypit/generation").GenerationMediaValue =>
      typeof value === "object" && value !== null && "artifact" in value,
  );
}

function support(request: EndpointRequest) {
  const value = request.constraints as unknown as GenerationRequest;
  const duration = scalar(value, "duration");
  const model = request.capability.name;
  if (model === minimaxH3Capability.name) {
    if (typeof duration === "number" && (duration < 4 || duration > 15)) {
      return { status: "unsupported" as const, reason: `MiniMax-H3 renders 4 to 15 seconds, not ${duration}` };
    }
    const videos = mediaItems(value, "referenceVideo").length + scalarItems(value, "referenceVideoUrl").length;
    const audios = mediaItems(value, "referenceAudio").length + scalarItems(value, "referenceAudioUrl").length;
    if (videos > 3) return { status: "unsupported" as const, reason: "MiniMax-H3 accepts at most 3 reference videos" };
    if (audios > 3) return { status: "unsupported" as const, reason: "MiniMax-H3 accepts at most 3 reference audio files" };
  } else if (typeof duration === "number" && (duration < 1 || duration > 30)) {
    return { status: "unsupported" as const, reason: `wan3.0-video renders 1 to 30 seconds, not ${duration}` };
  }
  const total = referenceCount(value);
  if (total > 12) {
    return { status: "unsupported" as const, reason: `${model} accepts at most 12 reference media items` };
  }
  return { status: "supported" as const };
}

function referenceCount(request: GenerationRequest): number {
  const counted = [
    mediaItems(request, "referenceImage").length + scalarItems(request, "referenceImageUrl").length,
    mediaItems(request, "referenceVideo").length + scalarItems(request, "referenceVideoUrl").length,
    mediaItems(request, "referenceAudio").length + scalarItems(request, "referenceAudioUrl").length,
  ];
  return counted.reduce((sum, value) => sum + value, 0);
}

function scalarItems(request: GenerationRequest, port: string): readonly string[] {
  return (request.ports[port] ?? []).filter((value): value is string => typeof value === "string" && value.trim().length > 0);
}

class ThreeRouterClient {
  readonly #base: string;
  readonly #fetcher: typeof globalThis.fetch;
  readonly #timeout: number;

  constructor(options: { readonly baseUrl: string; readonly requestTimeoutMs: number; readonly fetch: typeof globalThis.fetch }) {
    this.#base = options.baseUrl;
    this.#fetcher = options.fetch;
    this.#timeout = options.requestTimeoutMs;
  }

  async #json(path: string, key: string, init: RequestInit = {}): Promise<{ status: number; body: JsonObject }> {
    const response = await this.#fetcher(`${this.#base}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${key}`,
        ...(init.body === undefined ? {} : { "content-type": "application/json" }),
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(this.#timeout),
    });
    const textBody = await response.text();
    let parsed: unknown;
    try { parsed = textBody.length === 0 ? {} : JSON.parse(textBody); } catch { parsed = { message: textBody.slice(0, 2_000) }; }
    const body = object(parsed, `ThreeRouter HTTP ${response.status} response`);
    if (!response.ok) {
      const failure = publicFailure(body);
      throw new Error(`ThreeRouter HTTP ${response.status}${failure === undefined ? "" : ` ${failure.code}: ${failure.message}`}`);
    }
    return { status: response.status, body };
  }

  async create(body: JsonObject, key: string): Promise<JsonObject> {
    return (await this.#json("/videos/generations", key, {
      method: "POST",
      body: JSON.stringify(body),
    })).body;
  }

  async get(id: string, key: string): Promise<JsonObject> {
    return (await this.#json(`/videos/${encodeURIComponent(id)}`, key)).body;
  }

  async download(id: string, key: string): Promise<{ bytes: Uint8Array; mediaType: string }> {
    const response = await this.#fetcher(`${this.#base}/videos/${encodeURIComponent(id)}/content`, {
      headers: { authorization: `Bearer ${key}` },
      redirect: "follow",
      signal: AbortSignal.timeout(this.#timeout),
    });
    if (!response.ok) throw new Error(`ThreeRouter content returned HTTP ${response.status}`);
    const mediaType = response.headers.get("content-type")?.split(";", 1)[0]?.trim() ?? "video/mp4";
    assert(mediaType.startsWith("video/"), `ThreeRouter returned non-video content: ${mediaType}`);
    return { bytes: new Uint8Array(await response.arrayBuffer()), mediaType };
  }
}

function prepareBody(
  request: GenerationRequest,
  resolveArtifact: (artifact: BlobRef) => Promise<string>,
  model: string,
): Promise<JsonObject> {
  const body: JsonObject = {
    model,
    prompt: String(scalar(request, "prompt") ?? ""),
  };
  const duration = scalar(request, "duration");
  if (duration !== undefined) body.duration = duration;
  const resolution = scalar(request, "resolution");
  if (resolution !== undefined) body.resolution = resolution;
  const ratio = scalar(request, "aspectRatio");
  if (ratio !== undefined) body.ratio = ratio;
  const seed = scalar(request, "seed");
  if (seed !== undefined) body.seed = seed;

  const roles = [
    ["firstFrame", "firstFrameUrl", "first_frame"],
    ["lastFrame", "lastFrameUrl", "last_frame"],
    ["referenceImage", "referenceImageUrl", "reference_image"],
    ["referenceVideo", "referenceVideoUrl", "reference_video"],
    ["referenceAudio", "referenceAudioUrl", "reference_audio"],
  ] as const;
  return (async () => {
    const media: JsonObject[] = [];
    for (const [port, urlPort, type] of roles) {
      for (const item of mediaItems(request, port)) {
        media.push({ type, url: await resolveArtifact(item.artifact) });
      }
      for (const value of scalarItems(request, urlPort)) {
        media.push({ type, url: url(value, `${model} ${urlPort}`) });
      }
    }
    if (media.length > 0) body.media = media;
    return body;
  })();
}

function endpoint(options: {
  readonly client: ThreeRouterClient;
  readonly pollIntervalMs: number;
  readonly publicAssetUrl: CreateThreeRouterProviderOptions["publicAssetUrl"];
  readonly publishLocalAssets: boolean;
}): AsyncEndpoint {
  return {
    async start(context) {
      const request = context.need.constraints as unknown as GenerationRequest;
      const model = context.need.capability.name;
      assert(model === wan3VideoCapability.name || model === minimaxH3Capability.name,
        `ThreeRouter Provider does not serve capability ${model}`);
      const secret = apiKey(context.credentials);
      const resolved = new Map<string, Promise<string>>();
      const resolveArtifact = (artifact: BlobRef): Promise<string> => {
        const existing = resolved.get(artifact.resource);
        if (existing !== undefined) return existing;
        const promise = (async () => {
          if (options.publicAssetUrl !== undefined) {
            return url(await options.publicAssetUrl(artifact, context.resources), "ThreeRouter public asset URL");
          }
          if (options.publishLocalAssets) return uploadPublicAsset(artifact, context.resources);
          const bytes = await context.resources.get(artifact.resource);
          assert(bytes !== undefined, `${model} resource ${artifact.resource} is unavailable`);
          return `data:${artifact.mediaType};base64,${base64(bytes)}`;
        })();
        resolved.set(artifact.resource, promise);
        return promise;
      };
      await context.reportProgress?.({ phase: `Preparing ${model} request` });
      const body = await prepareBody(request, resolveArtifact, model);
      await context.reportProgress?.({ phase: `Submitting ${model} request` });
      const created = await options.client.create(body, secret);
      const id = text(created.id, "ThreeRouter video task id");
      const handle = { id };
      const receipt = { id };
      await context.checkpoint?.({ handle, receipt });
      return { ...wakeAfter(handle, options.pollIntervalMs), receipt };
    },
    async poll(context) {
      const id = text(object(context.handle, "ThreeRouter handle").id, "ThreeRouter task id");
      const task = await options.client.get(id, apiKey(context.credentials));
      const status = text(task.status, "ThreeRouter task status");
      if (status === "processing" || status === "queued" || status === "pending") {
        return wakeAfter({ id }, options.pollIntervalMs, Date.now(), { phase: status });
      }
      if (status === "failed" || status === "cancelled") {
        const failure = publicFailure(task);
        return {
          status: "failed",
          receipt: { id },
          failure: {
            code: failure?.code ?? `THREEROUTER_${status.toUpperCase()}`,
            message: `ThreeRouter task ${id} ${status}${failure === undefined ? "" : `: ${failure.message}`}`,
          },
        };
      }
      if (status !== "succeeded") throw new Error(`ThreeRouter returned unknown task status: ${status}`);
      return { status: "ready", handle: { id } };
    },
    async collect(context) {
      const id = text(object(context.handle, "ThreeRouter handle").id, "ThreeRouter task id");
      await context.reportProgress?.({ phase: "Receiving generated video" });
      const result = await options.client.download(id, apiKey(context.credentials));
      const artifact = await context.resources.put(result.bytes, result.mediaType);
      return { status: "completed", result: { value: {
        kind: "inline",
        value: canonicalize(sealGeneratedVideoSet({ videos: [artifact] })),
      } } };
    },
  };
}

export function createThreeRouterProvider(options: CreateThreeRouterProviderOptions) {
  const baseUrl = serviceBaseUrl(options.baseUrl);
  const fetcher = options.fetch ?? globalThis.fetch;
  const client = new ThreeRouterClient({
    baseUrl,
    fetch: fetcher,
    requestTimeoutMs: options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
  });
  return defineEndpointPackage({
    module: providerModule,
    facet: "videos",
    instance: options.instance,
    pool: options.pool,
    credentials: { apiKey: options.apiKey },
    credentialInputs: { apiKey: { label: "ThreeRouter API key" } },
    defaultConcurrency: options.defaultConcurrency ?? 1,
    actionLimits: { submit: { concurrency: 1 }, poll: { concurrency: 4 }, collect: { concurrency: 1 } },
    pricing: { kind: "page", url: "https://threerouter.com/pricing" },
    capabilities: [wan3VideoCapability, minimaxH3Capability].map((capability) => ({
      capability,
      returns: generationTypes.videoSet,
      lifecycle: "asynchronous" as const,
      supports: support,
      endpoint: endpoint({
        client,
        pollIntervalMs: options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
        publicAssetUrl: options.publicAssetUrl,
        publishLocalAssets: options.publishLocalAssets ?? true,
      }),
    })),
  });
}
