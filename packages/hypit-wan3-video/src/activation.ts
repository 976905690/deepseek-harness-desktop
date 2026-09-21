import { createMarkupSurfaceHostFacet } from "@hypit/hypit/author-kit";
import {
  wan3VideoComponent,
  wan3VideoHostFacet,
  wan3VideoManifest,
  wan3VideoMarkupSurfaces,
  wan3VideoModuleRef,
} from "./index.js";
import {
  decodeWan3FrameVideoSurface,
  decodeWan3ReferenceVideoSurface,
  decodeWan3TextVideoSurface,
} from "./surface.js";

export const hypitPackage = {
  format: "hypit.node-package@1" as const,
  modules: [{ manifest: wan3VideoManifest }],
  components: [wan3VideoComponent],
  hostFacets: [
    wan3VideoHostFacet,
    createMarkupSurfaceHostFacet({
      module: wan3VideoModuleRef,
      declaration: wan3VideoMarkupSurfaces.find((item) => item.name === "text-video")!,
      handler: decodeWan3TextVideoSurface,
    }),
    createMarkupSurfaceHostFacet({
      module: wan3VideoModuleRef,
      declaration: wan3VideoMarkupSurfaces.find((item) => item.name === "frame-video")!,
      handler: decodeWan3FrameVideoSurface,
    }),
    createMarkupSurfaceHostFacet({
      module: wan3VideoModuleRef,
      declaration: wan3VideoMarkupSurfaces.find((item) => item.name === "reference-video")!,
      handler: decodeWan3ReferenceVideoSurface,
    }),
  ],
};

export default hypitPackage;
