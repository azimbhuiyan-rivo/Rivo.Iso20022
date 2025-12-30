import type { HistoryEntry } from "../lib/storage";
import { downloadTextFile } from "../lib/download";

export function HistoryPage({ history, onClear }: { history: HistoryEntry[]; onClear: () => void }) {
  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h2 className="h" style={{ marginBottom: 0 }}>History</h2>
        <button className="danger" onClick={onClear} disabled={history.length === 0}>
          Clear
        </button>
      </div>

      {history.length === 0 ? (
        <div className="small" style={{ marginTop: 12 }}>No history yet.</div>
      ) : (
        <table style={{ marginTop: 14 }}>
          <thead>
            <tr>
              <th>Created</th>
              <th>Exec date</th>
              <th>AGI period</th>
              <th>Salaries</th>
              <th>Payments</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.id}>
                <td>{h.createdAt}</td>
                <td>{h.run.executionDate}</td>
                <td>{h.agiPeriod ?? "-"}</td>
                <td>{(h.salariesXml ? "Yes" : "No")}</td>
                <td>{(h.paymentsXml ? "Yes" : "No")}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button
                    onClick={() => h.salariesXml && downloadTextFile(`${h.run.executionDate}-salaries.xml`, h.salariesXml)}
                    disabled={!h.salariesXml}
                  >
                    Salaries
                  </button>{" "}
                  <button
                    onClick={() => h.paymentsXml && downloadTextFile(`${h.run.executionDate}-payments.xml`, h.paymentsXml)}
                    disabled={!h.paymentsXml}
                  >
                    Payments
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
