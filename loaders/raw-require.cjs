/**
 * `node --require ./loaders/raw-require.cjs`: lets scripts import the config and demo files
 * as strings (`import text from "…/weights.yaml?raw"`), as the app's bundler does.
 */
const fs = require("node:fs");
const Module = require("node:module");

const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  return resolveFilename.call(this, request.endsWith("?raw") ? request.slice(0, -"?raw".length) : request, ...rest);
};

for (const extension of [".yaml", ".md", ".csv"]) {
  Module._extensions[extension] = (module, filename) => {
    module.exports = fs.readFileSync(filename, "utf8");
  };
}
