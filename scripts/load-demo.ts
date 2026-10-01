/**
 * Load the bundled demo files into the CRM, exactly as a Deal flow upload of
 * demo/inbound_records.csv and demo/signals.csv would:
 *
 *     npm run demo:load
 */

import { createUpload, demoFiles } from "../src/lib/server/pipeline";
import { databasePath } from "../src/lib/db/connection";

const result = createUpload({ ...demoFiles(), uploadedBy: "npm run demo:load" });
if (!result.ok) {
  console.error(`Not processed: ${result.error}`);
  process.exit(1);
}
const { raw_records, companies, suggested_merges, passed_filters } = result.counts;
console.log(
  `Loaded into ${databasePath()}: ${raw_records} inbound records → ${companies} companies, ` +
    `${suggested_merges} suggested merges, ${passed_filters} passed the hard filters.`,
);
