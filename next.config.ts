import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      // `import text from "…/weights.yaml?raw"`: the config and the demo CSVs are bundled
      // as strings, so the triage rules can run in the browser.
      "*": {
        condition: { all: [{ not: "foreign" }, { query: /[?&]raw(?=&|$)/ }] },
        loaders: ["./loaders/raw-string.cjs"],
        as: "*.js",
      },
    },
  },
};

export default nextConfig;
