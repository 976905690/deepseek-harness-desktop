import {
  assertAttributes,
  assertEmptyElement,
  localName,
  sameType,
  textAttribute,
  optionalTextAttribute,
} from "@hypit/hypit/author-kit";
import type {
  CanonicalValue,
  StructuredElement,
  StructuredSurfaceHandler,
  SurfaceResolvedReference,
  TypeRef,
} from "@hypit/hypit/author-kit";
import {
  exactModelMediaInputNames,
  exactModelTextInputName,
  createExactModelPrimaryGenerationFragment,
} from "@hypit/hypit/model-kit";
import type { ExactModelEndpoint } from "@hypit/hypit/model-kit";
import {
  generationPort,
  sealGenerationMediaBinding,
  sealGenerationRequestDraft,
} from "@hypit/hypit/generation";
import type { GenerationMediaPort, GenerationPortValue } from "@hypit/hypit/generation";
import { artifactTypes } from "@hypit/hypit/artifact";
import { textTypes } from "@hypit/hypit/text";
import { wan3VideoEndpoints } from "./index.js";

type Media = {
  readonly port: string;
  readonly role: "image" | "video";
  readonly source?: SurfaceResolvedReference;
  readonly url?: string;
};

type UrlPort = {
  readonly port: string;
  readonly attribute: string;
};

const REFERENCE_URL_PORTS = [
  { port: "referenceImageUrl", attribute: "reference-image-url" },
  { port: "referenceVideoUrl", attribute: "reference-video-url" },
] as const;

const FRAME_URL_PORTS = [
  { port: "firstFrameUrl", attribute: "first-frame-url" },
  { port: "lastFrameUrl", attribute: "last-frame-url" },
] as const;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function exact(element: StructuredElement, allowed: readonly string[], required: readonly string[] = []): void {
  assertAttributes(element, allowed, required);
}

function text(element: StructuredElement, name: string): string {
  return textAttribute(element, name);
}

function optionalText(element: StructuredElement, name: string): string | undefined {
  return optionalTextAttribute(element, name);
}

function optionalInteger(element: StructuredElement, name: string): readonly GenerationPortValue[] | undefined {
  const raw = optionalText(element, name);
  if (raw === undefined) return undefined;
  assert(/^\d+$/u.test(raw), `${element.name}.${name} must be a whole number`);
  return [Number(raw)];
}

function publicUrl(element: StructuredElement, name: string): string {
  const raw = text(element, name).trim();
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`${element.name}.${name} must be an absolute HTTPS URL`);
  }
  assert(parsed.protocol === "https:", `${element.name}.${name} must use HTTPS`);
  return parsed.href;
}

function urlPorts(
  element: StructuredElement,
  entries: readonly UrlPort[],
): { ports: Record<string, readonly GenerationPortValue[]>; media: Media[] } {
  const ports: Record<string, readonly GenerationPortValue[]> = {};
  const media: Media[] = [];
  for (const { port, attribute } of entries) {
    const raw = optionalText(element, attribute);
    if (raw === undefined) continue;
    const value = publicUrl(element, attribute);
    ports[port] = [value];
    media.push({ port, role: port.toLowerCase().includes("video") ? "video" : "image", url: value });
  }
  return { ports, media };
}

function ref(
  element: StructuredElement,
  name: string,
  type: TypeRef,
  resolve: (path: string) => SurfaceResolvedReference | undefined,
): SurfaceResolvedReference {
  const value = element.attributes[name];
  assert(typeof value === "object" && value.kind === "reference", `${element.name}.${name} must be a reference`);
  const result = resolve(value.path);
  assert(result !== undefined && sameType(result.type, type), `${element.name}.${name} has the wrong type`);
  return result;
}

function common(element: StructuredElement, resolve: (path: string) => SurfaceResolvedReference | undefined) {
  const prompt = ref(element, "prompt", textTypes.text, resolve);
  if (prompt.record !== undefined) {
    assert(prompt.record.value.kind === "inline", `${element.name}.prompt must reference Text`);
  }
  const ports: Record<string, readonly GenerationPortValue[]> = {};
  const duration = optionalInteger(element, "duration");
  if (duration !== undefined) ports.duration = duration;
  const resolution = optionalText(element, "resolution");
  if (resolution !== undefined) ports.resolution = [resolution];
  const aspectRatio = optionalText(element, "aspect-ratio");
  if (aspectRatio !== undefined) ports.aspectRatio = [aspectRatio];
  const seed = optionalInteger(element, "seed");
  if (seed !== undefined) ports.seed = seed;
  return { prompt, ports };
}

function output(
  element: StructuredElement,
  prompt: SurfaceResolvedReference,
  ports: Record<string, readonly GenerationPortValue[]>,
  media: readonly Media[],
) {
  const id = text(element, "id");
  const draft = sealGenerationRequestDraft(wan3VideoEndpoints.video!.ports, ports);
  const records: Array<{ id: string; type: TypeRef; value: { kind: "inline"; value: CanonicalValue }; range: StructuredElement["range"] }> = [{
    id: `${id}.draft`,
    type: wan3VideoEndpoints.video!.draftType,
    value: { kind: "inline", value: draft as unknown as CanonicalValue },
    range: element.range,
  }];
  const inputs: Record<string, SurfaceResolvedReference["ref"] | { kind: "record"; id: string }> = {
    draft: { kind: "record", id: `${id}.draft` },
    [exactModelTextInputName("prompt")]: prompt.ref,
  };
  // URL references already travel as scalar port values in the draft. Only
  // admitted bytes need a media binding edge into the generation fragment.
  const bound = media.filter((item): item is Media & { source: SurfaceResolvedReference } => item.source !== undefined);
  const mediaInputs = bound.map((item, index) => {
    const name = `media-${String(index + 1).padStart(4, "0")}`;
    const binding = wan3VideoEndpoints.video!.mediaBindings[item.port]!;
    const port = generationPort(wan3VideoEndpoints.video!.ports, item.port);
    assert(port.value.kind === "media", `${item.port} is not media`);
    const bindingId = `${id}.${name}.binding`;
    records.push({
      id: bindingId,
      type: binding.type,
      value: { kind: "inline", value: sealGenerationMediaBinding(port as GenerationMediaPort, { role: item.role }) as unknown as CanonicalValue },
      range: element.range,
    });
    const names = exactModelMediaInputNames(name);
    inputs[names.binding] = { kind: "record", id: bindingId };
    inputs[names.artifact] = item.source.ref;
    return { name, port: item.port };
  });
  const fragment = createExactModelPrimaryGenerationFragment(wan3VideoEndpoints.video!, mediaInputs, [{ name: "prompt", port: "prompt" }]);
  return {
    records,
    fragments: [fragment],
    components: [{ id, fragment: fragment.id, inputs, outputs: { video: `${id}.video` }, range: element.range }],
  };
}

function mediaRef(
  element: StructuredElement,
  attribute: string,
  role: "image" | "video",
  resolve: (path: string) => SurfaceResolvedReference | undefined,
): SurfaceResolvedReference {
  const result = ref(element, attribute, artifactTypes.blob, resolve);
  if (result.record !== undefined) {
    assert(result.record.value.kind === "blob" && result.record.value.mediaType.startsWith(`${role}/`),
      `${element.name}.${attribute} must reference ${role} media`);
  }
  return result;
}

export const decodeWan3TextVideoSurface: StructuredSurfaceHandler = ({ element, resolveReference }) => {
  exact(element, [
    "id", "prompt", "duration", "resolution", "aspect-ratio", "seed",
    "reference-image-url", "reference-video-url",
  ], ["id", "prompt"]);
  assertEmptyElement(element);
  const { prompt, ports } = common(element, resolveReference);
  const urls = urlPorts(element, REFERENCE_URL_PORTS);
  Object.assign(ports, urls.ports);
  return output(element, prompt, ports, urls.media);
};

export const decodeWan3FrameVideoSurface: StructuredSurfaceHandler = ({ element, resolveReference }) => {
  exact(element, [
    "id", "prompt", "duration", "resolution", "first-frame", "last-frame",
    "first-frame-url", "last-frame-url", "seed",
  ], ["id", "prompt"]);
  assertEmptyElement(element);
  assert(
    ["first-frame", "last-frame", "first-frame-url", "last-frame-url"].some((name) => element.attributes[name] !== undefined),
    `${element.name} requires first-frame, last-frame, first-frame-url, last-frame-url or a combination`,
  );
  const { prompt, ports } = common(element, resolveReference);
  const frames = urlPorts(element, FRAME_URL_PORTS);
  Object.assign(ports, frames.ports);
  const media: Media[] = [];
  if (element.attributes["first-frame"] !== undefined) {
    media.push({ port: "firstFrame", role: "image", source: mediaRef(element, "first-frame", "image", resolveReference) });
  }
  if (element.attributes["last-frame"] !== undefined) {
    media.push({ port: "lastFrame", role: "image", source: mediaRef(element, "last-frame", "image", resolveReference) });
  }
  media.push(...frames.media);
  return output(element, prompt, ports, media);
};

export const decodeWan3ReferenceVideoSurface: StructuredSurfaceHandler = ({ element, resolveReference }) => {
  exact(element, [
    "id", "prompt", "duration", "resolution", "aspect-ratio", "seed",
    "reference-image-url", "reference-video-url",
  ], ["id", "prompt"]);
  const { prompt, ports } = common(element, resolveReference);
  const urls = urlPorts(element, REFERENCE_URL_PORTS);
  Object.assign(ports, urls.ports);
  const media: Media[] = [];
  for (const child of element.children) {
    if (child.kind === "text") {
      assert(child.value.trim().length === 0, `${element.name} accepts only Reference children`);
      continue;
    }
    assert(localName(child.name) === "Reference", `${element.name} accepts only Reference children`);
    const used = (["image", "video", "image-url", "video-url"] as const)
      .filter((name) => child.attributes[name] !== undefined);
    assert(used.length === 1, `${child.name} requires exactly one of image, video, image-url or video-url`);
    const source = used[0]!;
    exact(child, [source], [source]);
    assertEmptyElement(child);
    const role = source.includes("video") ? "video" : "image";
    if (source.endsWith("-url")) {
      const value = publicUrl(child, source);
      const port = role === "image" ? "referenceImageUrl" : "referenceVideoUrl";
      const existing = ports[port];
      ports[port] = [...(existing ?? []), value];
      media.push({ port, role, url: value });
      continue;
    }
    media.push({
      port: role === "image" ? "referenceImage" : "referenceVideo",
      role,
      source: mediaRef(child, source, role, resolveReference),
    });
  }
  media.push(...urls.media);
  assert(media.length > 0, `${element.name} requires at least one Reference`);
  for (const port of ["referenceImage", "referenceVideo"] as const) {
    const limit = generationPort(wan3VideoEndpoints.video!.ports, port).maxItems;
    assert(media.filter((item) => item.port === port).length <= limit, `${element.name} has too many ${port} references`);
  }
  for (const port of ["referenceImageUrl", "referenceVideoUrl"] as const) {
    const limit = generationPort(wan3VideoEndpoints.video!.ports, port).maxItems;
    assert((ports[port]?.length ?? 0) <= limit, `${element.name} has too many ${port} references`);
  }
  return output(element, prompt, ports, media);
};
