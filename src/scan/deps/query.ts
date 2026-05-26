import { resolveDepsProviderUrl } from "./config";
import { queryOsvForDependencies } from "./provider";
import { DepsFinding, DependencyCoordinate, DepsScanOptions } from "./types";

export async function queryDependencies(
  dependencies: DependencyCoordinate[],
  options: DepsScanOptions
): Promise<DepsFinding[]> {
  switch (options.provider) {
    case "osv":
      return queryOsvForDependencies(dependencies, {
        providerUrl: resolveDepsProviderUrl(options),
        timeoutMs: options.timeoutMs,
        http2Mode: options.http2Mode
      });
    case "custom":
      throw new Error(
        "Custom dependency providers are not implemented yet. " +
          "Use --deps-provider osv (default). " +
          "A custom provider API will be added in a future release."
      );
    default: {
      const unknown: never = options.provider;
      throw new Error(`Unknown dependency provider: ${unknown}`);
    }
  }
}
