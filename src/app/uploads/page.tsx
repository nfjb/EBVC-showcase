/** Deal flow uploads: upload the inbound CSV and the signals CSV, and run the triage pipeline. */

import { UploadForm } from "@/components/UploadForm";
import * as repo from "@/lib/db/repository";
import { formatTimestamp } from "@/lib/triage/dates";

export default function UploadsPage() {
  const uploads = repo.listUploads();
  return (
    <>
      <h1>Deal flow uploads</h1>
      <p className="caption">
        Merge records into companies and touchpoints, queue fuzzy matches as suggested merges, apply the hard filters and
        score every company.
      </p>
      <UploadForm />
      <h2 style={{ marginTop: 28 }}>Previous runs</h2>
      {!uploads.length ? (
        <p className="caption">No uploads yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>When</th>
                <th>By</th>
                <th>Inbound file</th>
                <th>Signals file</th>
                <th className="num">Raw records</th>
                <th className="num">Companies</th>
                <th className="num">Suggested merges</th>
                <th className="num">Passed filters</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {uploads.map((upload) => (
                <tr key={upload.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{formatTimestamp(upload.created_at)}</td>
                  <td>{upload.uploaded_by}</td>
                  <td>{upload.inbound_file}</td>
                  <td>{upload.signals_file}</td>
                  <td className="num">{upload.raw_record_count}</td>
                  <td className="num">{upload.company_count}</td>
                  <td className="num">{upload.suggested_merge_count}</td>
                  <td className="num">{upload.passed_filter_count}</td>
                  <td>{upload.status === "success" ? "✅ Processed" : `⚠️ Failed: ${upload.error}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
