import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

const nextConfig = {
  outputFileTracingRoot: repositoryRoot,
  transpilePackages: ["@discovery-box/builder", "@discovery-box/catalog"],
  turbopack: { root: repositoryRoot },
};

export default nextConfig;
