import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const nextConfig = {
  turbopack: {
    root: dirname(fileURLToPath(import.meta.url)),
  },
};

export default nextConfig;
