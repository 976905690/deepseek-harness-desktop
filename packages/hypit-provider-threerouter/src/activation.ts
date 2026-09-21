import {
  createRuntimeEndpointAdapterFacet,
  runtimeConfigCredentialRef,
  runtimeConfigExact,
  runtimeConfigObject,
  runtimeConfigPositiveInteger,
  runtimeConfigString,
} from "@hypit/hypit/runtime-kit";
import { createThreeRouterProvider } from "./provider.js";

const adapter = createRuntimeEndpointAdapterFacet({
  use: "@local/hypit-provider-threerouter",
  activate(context) {
    if (context.pool === undefined) throw new Error("ThreeRouter Provider pool is required");
    const config = runtimeConfigObject(context.config, "ThreeRouter");
    runtimeConfigExact(config, [
      "baseUrl",
      "apiKey",
      "defaultConcurrency",
      "pollIntervalMs",
      "requestTimeoutMs",
    ], "ThreeRouter");
    const apiKey = runtimeConfigCredentialRef(config.apiKey, "ThreeRouter apiKey");
    if (apiKey === undefined) throw new Error("ThreeRouter apiKey CredentialRef is required");
    const baseUrl = runtimeConfigString(config.baseUrl, "ThreeRouter baseUrl");
    const defaultConcurrency = runtimeConfigPositiveInteger(config.defaultConcurrency, "ThreeRouter defaultConcurrency");
    const pollIntervalMs = runtimeConfigPositiveInteger(config.pollIntervalMs, "ThreeRouter pollIntervalMs");
    const requestTimeoutMs = runtimeConfigPositiveInteger(config.requestTimeoutMs, "ThreeRouter requestTimeoutMs");
    return {
      endpoint: createThreeRouterProvider({
        instance: context.instance,
        pool: context.pool,
        apiKey,
        ...(baseUrl === undefined ? {} : { baseUrl }),
        ...(defaultConcurrency === undefined ? {} : { defaultConcurrency }),
        ...(pollIntervalMs === undefined ? {} : { pollIntervalMs }),
        ...(requestTimeoutMs === undefined ? {} : { requestTimeoutMs }),
      }),
    };
  },
});

export const hypitPackage = {
  format: "hypit.node-package@1" as const,
  hostFacets: [adapter],
};

export default hypitPackage;
