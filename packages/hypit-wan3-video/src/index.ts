import { artifactTypes } from "@hypit/hypit/artifact";
import { sealGenerationPortRequest, sealGenerationPortTable } from "@hypit/hypit/generation";
import type { GenerationPortTable, GenerationPortValue, GenerationRequest } from "@hypit/hypit/generation";
import { defineExactModelModule } from "@hypit/hypit/model-kit";
import { textTypes } from "@hypit/hypit/text";

export const wan3VideoModuleRef = { name: "@local/wan3-video", version: "1" } as const;
export const wan3VideoModel = "wan3.0-video" as const;

const RESOLUTIONS = ["480p", "720p", "1080p"] as const;
const ASPECT_RATIOS = ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"] as const;
const MAX_URL_CHARS = 8_192;

/**
 * ThreeRouter's `media[]` entries carry a URL. A public HTTPS link is passed
 * through unchanged; admitted local media travels as an inlined data URI. The
 * URL ports below keep a link the author already has on the public internet
 * out of the local resource pipeline entirely.
 */
const urlPort = (name: string, maximum: number) => ({
  name,
  value: { kind: "text" as const, maxChars: MAX_URL_CHARS },
  minItems: 0,
  maxItems: maximum,
});

export const wan3VideoPorts: GenerationPortTable = sealGenerationPortTable({
  model: wan3VideoModel,
  result: "video",
  ports: [
    { name: "prompt", value: { kind: "text", maxChars: 20_000 }, minItems: 1, maxItems: 1 },
    {
      name: "duration",
      value: { kind: "number", integer: true, minimum: 1, maximum: 30 },
      minItems: 0,
      maxItems: 1,
    },
    { name: "resolution", value: { kind: "enum", values: [...RESOLUTIONS] }, minItems: 0, maxItems: 1 },
    { name: "aspectRatio", value: { kind: "enum", values: [...ASPECT_RATIOS] }, minItems: 0, maxItems: 1 },
    { name: "seed", value: { kind: "number", integer: true, minimum: 0, maximum: 2_147_483_647 }, minItems: 0, maxItems: 1 },
    { name: "referenceImage", value: { kind: "media", accepts: ["image"] }, minItems: 0, maxItems: 9 },
    { name: "referenceVideo", value: { kind: "media", accepts: ["video"] }, minItems: 0, maxItems: 3 },
    { name: "firstFrame", value: { kind: "media", accepts: ["image"] }, minItems: 0, maxItems: 1 },
    { name: "lastFrame", value: { kind: "media", accepts: ["image"] }, minItems: 0, maxItems: 1 },
    urlPort("referenceImageUrl", 9),
    urlPort("referenceVideoUrl", 3),
    urlPort("firstFrameUrl", 1),
    urlPort("lastFrameUrl", 1),
  ],
  requires: [
    { kind: "atMostOneOf", ports: ["referenceImage", "referenceImageUrl", "firstFrame", "firstFrameUrl"] },
    { kind: "atMostOneOf", ports: ["referenceImage", "referenceImageUrl", "lastFrame", "lastFrameUrl"] },
    { kind: "atMostOneOf", ports: ["referenceVideo", "referenceVideoUrl", "firstFrame", "firstFrameUrl"] },
    { kind: "atMostOneOf", ports: ["referenceVideo", "referenceVideoUrl", "lastFrame", "lastFrameUrl"] },
    { kind: "atMostOneOf", ports: ["aspectRatio", "firstFrame", "firstFrameUrl"] },
    { kind: "atMostOneOf", ports: ["aspectRatio", "lastFrame", "lastFrameUrl"] },
    {
      kind: "weightedTotal",
      weights: {
        referenceImage: 1,
        referenceVideo: 1,
        referenceImageUrl: 1,
        referenceVideoUrl: 1,
      },
      maximum: 12,
    },
  ],
});

export function sealWan3VideoRequest(
  ports: Readonly<Record<string, readonly GenerationPortValue[]>>,
): GenerationRequest {
  return sealGenerationPortRequest(wan3VideoPorts, ports);
}

const baseDefinition = defineExactModelModule({
  module: wan3VideoModuleRef,
  endpoints: [{
    key: "video",
    requestTypeName: "Wan3VideoRequest",
    producerName: "request-wan3-video",
    ports: wan3VideoPorts,
  }],
});

export const wan3VideoEndpoints = baseDefinition.endpoints;
export const wan3VideoComponent = baseDefinition.component;
export const wan3VideoManifest = baseDefinition.manifest;
export const wan3VideoHostFacet = baseDefinition.hostFacet;
const endpoint = wan3VideoEndpoints.video!;

const commonAttributes = [
  { name: "id", kind: "identifier", required: true,
    summary: "Names this generation and prefixes the bindings it publishes." },
  { name: "prompt", kind: "reference", required: true, accepts: [textTypes.text],
    summary: "The Text edge describing the shot or the change to make." },
  { name: "duration", kind: "literal", required: false,
    summary: "Whole seconds to render, from 1 through 30." },
  { name: "resolution", kind: "literal", required: false, values: [...RESOLUTIONS],
    summary: "The output resolution band." },
  { name: "aspect-ratio", kind: "literal", required: false, values: [...ASPECT_RATIOS],
    summary: "The output frame ratio when no first or last frame fixes it." },
  { name: "seed", kind: "literal", required: false,
    summary: "An optional integer seed for a reproducible request." },
] as const;

const urlAttributes = [
  { name: "reference-image-url", kind: "literal", required: false,
    summary: "A public HTTPS image URL used as a visual reference." },
  { name: "reference-video-url", kind: "literal", required: false,
    summary: "A public HTTPS video URL used as a visual reference." },
] as const;

const referenceChild = {
  tag: "Reference",
  cardinality: "many",
  summary: "One image or video used as a visual reference, from a file or a public URL.",
  attributes: [
    { name: "image", kind: "reference", required: false, accepts: [artifactTypes.blob],
      summary: "An image Artifact used as a reference image." },
    { name: "video", kind: "reference", required: false, accepts: [artifactTypes.blob],
      summary: "A video Artifact used as a reference video." },
    { name: "image-url", kind: "literal", required: false,
      summary: "A public HTTPS image URL used as a reference image." },
    { name: "video-url", kind: "literal", required: false,
      summary: "A public HTTPS video URL used as a reference video." },
  ],
} as const;

function declaration<const Vocabulary>(name: string, tag: string, vocabulary: Vocabulary) {
  return {
    name,
    tag,
    mode: "structured" as const,
    outputs: [endpoint.draftType, ...Object.values(endpoint.mediaBindings).map((binding) => binding.type)],
    vocabulary,
  };
}

export const wan3VideoMarkupSurfaces = [
  declaration("text-video", "TextVideo", {
    summary: "Renders a Wan 3.0 video from a prompt and optional public-URL references.",
    attributes: [...commonAttributes, ...urlAttributes],
    example: `<wan3:TextVideo id="shot" prompt={prompt} duration="5" resolution="1080p" aspect-ratio="9:16"/>`,
  }),
  declaration("frame-video", "FrameVideo", {
    summary: "Renders a Wan 3.0 video between one supplied first frame and one optional last frame.",
    attributes: [...commonAttributes, 
      { name: "first-frame", kind: "reference", required: false, accepts: [artifactTypes.blob],
        summary: "The image that starts the shot." },
      { name: "last-frame", kind: "reference", required: false, accepts: [artifactTypes.blob],
        summary: "The image that ends the shot." },
      { name: "first-frame-url", kind: "literal", required: false,
        summary: "A public HTTPS image URL that starts the shot." },
      { name: "last-frame-url", kind: "literal", required: false,
        summary: "A public HTTPS image URL that ends the shot." },
    ],
    example: `<wan3:FrameVideo id="shot" prompt={prompt} duration="5" first-frame={start}/>` ,
  }),
  declaration("reference-video", "ReferenceVideo", {
    summary: "Renders a Wan 3.0 video from image and video references supplied as children.",
    attributes: [...commonAttributes, ...urlAttributes],
    children: [referenceChild],
    example: `<wan3:ReferenceVideo id="shot" prompt={prompt} duration="5"><wan3:Reference image={portrait}/></wan3:ReferenceVideo>`,
  }),
] as const;
