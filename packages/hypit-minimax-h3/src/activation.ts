import { createMarkupSurfaceHostFacet } from "@hypit/hypit/author-kit";
import {
  minimaxH3Component,
  minimaxH3HostFacet,
  minimaxH3Manifest,
  minimaxH3MarkupSurfaces,
  minimaxH3ModuleRef,
} from "./index.js";
import {
  decodeMinimaxH3ReferenceVideoSurface,
  decodeMinimaxH3TextVideoSurface,
} from "./surface.js";

export const hypitPackage = {
  format: "hypit.node-package@1" as const,
  modules: [{ manifest: minimaxH3Manifest }],
  components: [minimaxH3Component],
  hostFacets: [
    minimaxH3HostFacet,
    createMarkupSurfaceHostFacet({
      module: minimaxH3ModuleRef,
      declaration: minimaxH3MarkupSurfaces.find((item) => item.name === "text-video")!,
      handler: decodeMinimaxH3TextVideoSurface,
    }),
    createMarkupSurfaceHostFacet({
      module: minimaxH3ModuleRef,
      declaration: minimaxH3MarkupSurfaces.find((item) => item.name === "reference-video")!,
      handler: decodeMinimaxH3ReferenceVideoSurface,
    }),
  ],
};

export default hypitPackage;
