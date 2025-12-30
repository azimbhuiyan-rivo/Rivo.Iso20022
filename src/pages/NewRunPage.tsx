import React, { useMemo, useState } from "react";
import type { Profile, RunInput } from "../lib/types";
import { parseAgiXml } from "../lib/agi";
import { buildPaymentsXml, buildSalariesXml, digits } from "../lib/pain001";
import { downloadTextFile } from "../lib/download";
import { makeHistoryEntry, type HistoryEntry } from "../lib/storage";

type Props = {
  profile: Profile;
  hasProfile: boolean;
  onGoProfile: () => void;
  onSaveHistory: (entry: HistoryEntry) => void;
};

const RUN_DEFAULT: RunInput = {
  executionDate: "",
  salary_ab: 0,
  salary_an: 0,
  avdragen_skatt: 0,
  agi: 0,
  moms: 0,
  tele2_amount: 0,
  tele2_ocr: "",
};

function toNumber(v: string): number {
  const s = (v ?? "").toString().trim();
  if (!s) return 0;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function todayIso(): string {
  const d = new Date();
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fmtSek(n: number): string {
  return n.toFixed(2);
}

export function NewRunPage({ profile, hasProfile, onGoProfile, onSaveHistory }: Props) {
  const [run, setRun] = useState<RunInput>(() => ({ ...RUN_DEFAULT, executionDate: todayIso() }));
  const [status, setStatus] = useState<{ kind: "ok" | "warn"; text: string } | null>(null);
  const [agiMeta, setAgiMeta] = useState<{ fileName: string; period?: string } | null>(null);

  const tele2NeedsOcr = useMemo(() => run.tele2_amount > 0 && digits(run.tele2_ocr) === "", [run.tele2_amount, run.tele2_ocr]);

  const salariesXml = useMemo(() => {
    try {
      return buildSalariesXml(profile, run);
    } catch (e: any) {
      return null;
    }
  }, [profile, run]);

  const paymentsResult = useMemo(() => {
    try {
      const xml = buildPaymentsXml(profile, run);
      if (!xml && tele2NeedsOcr) {
        return { xml: null as string | null, error: "Tele2 OCR is required when Tele2 amount > 0." };
      }
      return { xml, error: null as string | null };
    } catch (e: any) {
      return { xml: null as string | null, error: e?.message ? String(e.message) : "Failed to build payments XML." };
    }
  }, [profile, run, tele2NeedsOcr]);

  const outputs = useMemo(() => {
    const salaryTx = (run.salary_ab > 0 ? 1 : 0) + (run.salary_an > 0 ? 1 : 0);
    const paymentsTx =
      (run.agi > 0 ? 1 : 0) +
      (run.avdragen_skatt > 0 ? 1 : 0) +
      (run.moms > 0 ? 1 : 0) +
      (run.tele2_amount > 0 ? 1 : 0);

    const salarySum = run.salary_ab + run.salary_an;
    const paymentsSum = run.agi + run.avdragen_skatt + run.moms + run.tele2_amount;

    return { salaryTx, paymentsTx, salarySum, paymentsSum };
  }, [run]);

  function setField<K extends keyof RunInput>(key: K, value: RunInput[K]) {
    setRun((r) => ({ ...r, [key]: value }));
  }

  async function onPickAgi(file: File | null) {
    if (!file) return;

    const xmlText = await file.text();
    const parsed = parseAgiXml(xmlText);

    setAgiMeta({ fileName: file.name, period: parsed.period });

    const azimId = profile.employees.azim.personnummer;
    const aynunId = profile.employees.aynun.personnummer;

    const az = parsed.byPersonId.get(azimId);
    const an = parsed.byPersonId.get(aynunId);

    const missing: string[] = [];
    if (!hasProfile) missing.push("Profile incomplete");
    if (!az) missing.push("Azim personnummer mapping");
    if (!an) missing.push("Aynun personnummer mapping");

    setRun((r) => ({
      ...r,
      salary_ab: az ? az.gross - az.tax : 0,
      salary_an: an ? an.gross - an.tax : 0,
      agi: parsed.totalsAgi,
      avdragen_skatt: parsed.totalsAvdragenSkatt,
    }));

    if (missing.length) {
      setStatus({ kind: "warn", text: `AGI loaded (period ${parsed.period ?? "?"}), but missing: ${missing.join(", ")}.` });
    } else {
      setStatus({ kind: "ok", text: `AGI loaded (period ${parsed.period ?? "?"}). Salaries + AGI + Avdragen skatt filled.` });
    }
  }

  function reset() {
    setRun({ ...RUN_DEFAULT, executionDate: todayIso() });
    setStatus(null);
    setAgiMeta(null);
  }

  function downloadSalaries() {
    if (!salariesXml) return;
    downloadTextFile(`${run.executionDate}-salaries.xml`, salariesXml);
  }

  function downloadPayments() {
    if (!paymentsResult.xml) return;
    downloadTextFile(`${run.executionDate}-payments.xml`, paymentsResult.xml);
  }

  function saveToHistory() {
    const entry = makeHistoryEntry(run, salariesXml, paymentsResult.xml, agiMeta?.period);
    onSaveHistory(entry);
    setStatus({ kind: "ok", text: "Saved to history." });
  }

  return (
    <div className="card">
      {status?.kind === "warn" && <div className="small warn">{status.text}</div>}
      {status?.kind === "ok" && <div className="small ok">{status.text}</div>}
      {paymentsResult.error && <div className="small warn">{paymentsResult.error}</div>}

      <div className="row">
        <div className="col">
          <h2 className="h">New run</h2>

          <label>Execution date (YYYY-MM-DD)</label>
          <input value={run.executionDate} placeholder="YYYY-MM-DD" onChange={(e) => setField("executionDate", e.target.value)} />

          <label>Load AGI XML (auto-fills salaries + AGI + avdragen skatt)</label>
          <input type="file" accept=".xml" onChange={(e) => onPickAgi(e.target.files?.[0] ?? null)} />
          {agiMeta && <div className="small">AGI: {agiMeta.fileName}{agiMeta.period ? ` (period ${agiMeta.period})` : ""}</div>}

          <hr />

          <h3 className="h3">Salaries</h3>

          <label>Azim Salary</label>
          <input value={String(run.salary_ab)} onChange={(e) => setField("salary_ab", toNumber(e.target.value))} inputMode="decimal" />

          <label>Aynun Salary</label>
          <input value={String(run.salary_an)} onChange={(e) => setField("salary_an", toNumber(e.target.value))} inputMode="decimal" />

          <hr />

          <h3 className="h3">Skatteverket</h3>

          <label>Avdragen Skatt</label>
          <input value={String(run.avdragen_skatt)} onChange={(e) => setField("avdragen_skatt", toNumber(e.target.value))} inputMode="decimal" />

          <label>Arbetsgivaravgift</label>
          <input value={String(run.agi)} onChange={(e) => setField("agi", toNumber(e.target.value))} inputMode="decimal" />

          <label>MOMS</label>
          <input value={String(run.moms)} onChange={(e) => setField("moms", toNumber(e.target.value))} inputMode="decimal" />

          <hr />

          <h3 className="h3">Tele2</h3>

          <label>Tele2 amount</label>
          <input value={String(run.tele2_amount)} onChange={(e) => setField("tele2_amount", toNumber(e.target.value))} inputMode="decimal" />

          <label>Tele2 OCR</label>
          <input value={run.tele2_ocr} placeholder="Digits only" onChange={(e) => setField("tele2_ocr", e.target.value)} />
        </div>

        <div className="col">
          <h2 className="h">Outputs (two files)</h2>

          <div className="small">
            Salaries file (upload under <b>Lön</b>): {outputs.salaryTx} tx — {fmtSek(outputs.salarySum)} SEK
            <br />
            Payments file (upload under <b>Utbetalning (ISO 20022)</b>): {outputs.paymentsTx} tx — {fmtSek(outputs.paymentsSum)} SEK
          </div>

          <div className="btnRow">
            <button className="primary" onClick={downloadSalaries} disabled={!salariesXml}>
              Download salaries XML
            </button>
            <button className="primary" onClick={downloadPayments} disabled={!paymentsResult.xml}>
              Download payments XML
            </button>
          </div>

          <div className="btnRow">
            <button onClick={saveToHistory}>Save to history</button>
            <button className="danger" onClick={reset}>
              Reset
            </button>
          </div>

          {!hasProfile && (
            <div className="small warn" style={{ marginTop: 12 }}>
              Profile is incomplete. Go to <b>Profile</b> and fill the required values.{" "}
              <button style={{ marginLeft: 10 }} onClick={onGoProfile}>
                Go to Profile
              </button>
            </div>
          )}

          {tele2NeedsOcr && (
            <div className="small warn" style={{ marginTop: 12 }}>
              Tele2 OCR is required when Tele2 amount &gt; 0.
            </div>
          )}

          <div className="small" style={{ marginTop: 12 }}>
            Tip: if you want salary visible on D, set execution date to D−1 banking day.
          </div>
        </div>
      </div>
    </div>
  );
}
