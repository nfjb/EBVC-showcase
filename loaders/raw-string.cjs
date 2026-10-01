/** Turn a text file into `export default "…"` so the CRM config and demo CSVs can load in the browser. */
module.exports = function rawStringLoader(source) {
  return `export default ${JSON.stringify(typeof source === "string" ? source : String(source))};`;
};
