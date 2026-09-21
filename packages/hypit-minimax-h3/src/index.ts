import { artifactTypes } from "@hypit/hypit/artifact";
import { sealGenerationPortRequest, sealGenerationPortTable } from "@hypit/hypit/generation";
import type { GenerationPortTable, GenerationPortValue, GenerationRequest } from "@hypit/hypit/generation";
import { defineExactModelModule } from "@hypit/hypit/model-kit";
import { textTypes } from "@hypit/hypit/text";

export const minimaxH3ModuleRef = { name: "@local/minimax-h3", version: "1" } as const;
export const minimaxH3Model = "MiniMax-H3" as const;

const RESOLUTIONS = ["768P", "2K"] as const;
const ASPECT_RATIOS = ["adaptive", "16:9", "9:16", "1:1", "4:3", "3:4", "21:9"] as const;
const MAX_URL_CHARS = 8_192;

const urlPort = (name: string, maximum: number) => ({
  name,
  value: { kind: "text" as const, maxChars: MAX_URL_CHARS },
  minItems: 0,
  maxItems: maximum,
});

export const minimaxH3Ports: GenerationPortTable = sealGenerationPortTable({
  model: minimaxH3Model,
  result: "video",
  ports: [
    { name: "prompt", value: { kind: "text", maxChars: 20_000 }, minItems: 1, maxItems: 1 },
    {
      name: "duration",
      value: { kind: "number", integer: true, minimum: 4, maximum: 15 },
      minItems: 0,
      maxItems: 1,
    },
    { name: "resolution", value: { kind: "enum", values: [...RESOLUTIONS] }, minItems: 0, maxItems: 1 },
    { name: "aspectRatio", value: { kind: "enum", values: [...ASPECT_RATIOS] }, minItems: 0, maxItems: 1 },
    { name: "referenceImage", value: { kind: "media", accepts: ["image"] }, minItems: 0, maxItems: 9 },
    { name: "referenceVideo", value: { kind: "media", accepts: ["video"] }, minItems: 0, maxItems: 3 },
    { name: "referenceAudio", value: { kind: "media", accepts: ["audio"] }, minItems: 0, maxItems: 3 },
    { name: "firstFrame", value: { kind: "media", accepts: ["image"] }, minItems: 0, maxItems: 1 },
    { name: "lastFrame", value: { kind: "media", accepts: ["image"] }, minItems: 0, maxItems: 1 },
    urlPort("referenceImageUrl", 9),
    urlPort("referenceVideoUrl", 3),
    urlPort("referenceAudioUrl", 3),
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
        referenceAudio: 1,
        referenceImageUrl: 1,
        referenceVideoUrl: 1,
        referenceAudioUrl: 1,
      },
      maximum: 12,
    },
  ],
});

export function sealMinimaxH3Request(
  ports: Readonly<Record<string, readonly GenerationPortValue[]>>,
): GenerationRequest {
  return sealGenerationPortRequest(minimaxH3Ports, ports);
}

const baseDefinition = defineExactModelModule({
  module: minimaxH3ModuleRef,
  endpoints: [{
    key: "video",
    requestTypeName: "MiniMaxH3Request",
    producerName: "request-minimax-h3",
    ports: minimaxH3Ports,
  }],
});

export const minimaxH3Endpoints = baseDefinition.endpoints;
export const minimaxH3Component = baseDefinition.component;
export const minimaxH3Manifest = baseDefinition.manifest;
export const minimaxH3HostFacet = baseDefinition.hostFacet;
const endpoint = minimaxH3Endpoints.video!;

const commonAttributes = [
  { name: "id", kind: "identifier", required: true,
    summary: "Names this generation and prefixes the bindings it publishes." },
  { name: "prompt", kind: "reference", required: true, accepts: [textTypes.text],
    summary: "The Text edge describing the shot or the change to make." },
  { name: "duration", kind: "literal", required: false,
    summary: "Whole seconds to render, from 4 through 15." },
  { name: "resolution", kind: "literal", required: false, values: [...RESOLUTIONS],
    summary: "The output resolution band." },
  { name: "aspect-ratio", kind: "literal", required: false, values: [...ASPECT_RATIOS],
    summary: "The output frame ratio. Use adaptive when reference media fixes the frame." },
] as const;

const urlAttributes = [
  { name: "reference-image-url", kind: "literal", required: false,
    summary: "A public HTTPS image URL used as a visual reference." },
  { name: "reference-video-url", kind: "literal", required: false,
    summary: "A public HTTPS video URL used as a visual reference." },
  { name: "reference-audio-url", kind: "literal", required: false,
    summary: "A public HTTPS audio URL used as an audio reference." },
] as const;

const referenceChild = {
  tag: "Reference",
  cardinality: "many",
  summary: "One image, video or audio reference from a file or a public URL.",
  attributes: [
    { name: "image", kind: "reference", required: false, accepts: [artifactTypes.blob],
      summary: "An image Artifact used as a reference image." },
    { name: "video", kind: "reference", required: false, accepts: [artifactTypes.blob],
      summary: "A video Artifact used as a reference video." },
    { name: "audio", kind: "reference", required: false, accepts: [artifactTypes.blob],
      summary: "An audio Artifact used as a reference audio." },
    { name: "image-url", kind: "literal", required: false,
      summary: "A public HTTPS image URL used as a reference image." },
    { name: "video-url", kind: "literal", required: false,
      summary: "A public HTTPS video URL used as a reference video." },
    { name: "audio-url", kind: "literal", required: false,
      summary: "A public HTTPS audio URL used as an audio reference." },
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

export const minimaxH3MarkupSurfaces = [
  declaration("text-video", "TextVideo", {
    summary: "Renders a MiniMax-H3 video from a prompt and optional public-URL references.",
    attributes: [...commonAttributes, ...urlAttributes],
    example: `<h3:TextVideo id="shot" prompt={prompt} duration="5" resolution="768P" aspect-ratio="16:9"/>`,
  }),
  declaration("reference-video", "ReferenceVideo", {
    summary: "Renders a MiniMax-H3 video from image, video and audio references supplied as children.",
    attributes: [...commonAttributes, ...urlAttributes],
    children: [referenceChild],
    example: `<h3:ReferenceVideo id="shot" prompt={prompt} duration="5" resolution="768P" aspect-ratio="adaptive"><h3:Reference image={portrait}/><h3:Reference video={source}/></h3:ReferenceVideo>`,
  }),
] as const;
