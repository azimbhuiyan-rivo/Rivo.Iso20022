import { useMemo, useRef, useState } from "react";
import type { Profile, RunInput } from "../lib/types";
import { parseAgiXml } from "../lib/agi";
import { parseMomsXml } from "../lib/moms";
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
  adj_ab: 0,
  adj_an: 0,
  avdragen_skatt: 0,
  agi: 0,
  moms: 0,
  tele2_amount: 0,
  tele2_ocr: "",
  dnb_amount: 0,
  dnb_ocr: "",
  lans_amount: 0,
  lans_ocr: "",
};

function toNumber(v: string): number {
  const s = (v ?? "").toString().trim();
  if (!s) return 0;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function fmtSek(n: number): string {
  return n.toFixed(2);
}

function fmtInputNumber(n: number): string {
  return n === 0 ? "" : String(n);
}

function minifyXml(xml: string): string {
  return (xml ?? "").replace(/>\s+</g, "><").trim();
}

function isPreferredExecutionDate(iso: string): boolean {
  const parts = (iso ?? "").split("-");
  if (parts.length !== 3) return true;
  const day = Number(parts[2]);
  return day === 22 || day === 23 || day === 24;
}

export function NewRunPage({ profile, hasProfile, onGoProfile, onSaveHistory }: Props) {
  const [run, setRun] = useState<RunInput>(() => ({ ...RUN_DEFAULT }));
  const [status, setStatus] = useState<{ kind: "ok" | "warn"; text: string } | null>(null);
  const [agiMeta, setAgiMeta] = useState<{ fileName: string; period?: string } | null>(null);

  const [includeAdjAb, setIncludeAdjAb] = useState(false);
  const [includeAdjAn, setIncludeAdjAn] = useState(false);
  const [adjAbText, setAdjAbText] = useState("");
  const [adjAnText, setAdjAnText] = useState("");

  const [includeMoms, setIncludeMoms] = useState(false);
  const [momsMeta, setMomsMeta] = useState<{ fileName: string; period?: string; orgNr?: string } | null>(null);

  const [includeLans, setIncludeLans] = useState(false);

  const dateRef = useRef<HTMLInputElement | null>(null);

  const executionReady = useMemo(() => Boolean(run.executionDate && run.executionDate.trim()), [run.executionDate]);
  const agiReady = useMemo(() => Boolean(agiMeta), [agiMeta]);
  const momsReady = useMemo(() => !includeMoms || Boolean(momsMeta), [includeMoms, momsMeta]);

  const tele2OcrDigits = useMemo(() => digits(run.tele2_ocr), [run.tele2_ocr]);
  const tele2BgDigits = useMemo(() => digits(profile.tele2Bg ?? ""), [profile.tele2Bg]);
  const tele2AmountEnabled = useMemo(() => tele2OcrDigits !== "", [tele2OcrDigits]);
  const tele2Ready = useMemo(() => run.tele2_amount > 0 && tele2OcrDigits !== "" && tele2BgDigits !== "", [run.tele2_amount, tele2OcrDigits, tele2BgDigits]);
  const tele2MissingForPayments = useMemo(() => !tele2Ready, [tele2Ready]);
  const tele2NeedsOcr = useMemo(() => run.tele2_amount > 0 && tele2OcrDigits === "", [run.tele2_amount, tele2OcrDigits]);
  const tele2NeedsBg = useMemo(() => run.tele2_amount > 0 && tele2BgDigits === "", [run.tele2_amount, tele2BgDigits]);

  const dnbOcrDigits = useMemo(() => digits(run.dnb_ocr), [run.dnb_ocr]);
  const dnbBgDigits = useMemo(() => digits(profile.dnbBg ?? ""), [profile.dnbBg]);
  const dnbAmountEnabled = useMemo(() => dnbOcrDigits !== "", [dnbOcrDigits]);
  const dnbReady = useMemo(() => run.dnb_amount > 0 && dnbOcrDigits !== "" && dnbBgDigits !== "", [run.dnb_amount, dnbOcrDigits, dnbBgDigits]);
  const dnbMissingForPayments = useMemo(() => !dnbReady, [dnbReady]);
  const dnbNeedsOcr = useMemo(() => run.dnb_amount > 0 && dnbOcrDigits === "", [run.dnb_amount, dnbOcrDigits]);
  const dnbNeedsBg = useMemo(() => run.dnb_amount > 0 && dnbBgDigits === "", [run.dnb_amount, dnbBgDigits]);

  const lansOcrDigits = useMemo(() => digits(run.lans_ocr), [run.lans_ocr]);
  const lansBgDigits = useMemo(() => digits(profile.lansforsakringarBg ?? ""), [profile.lansforsakringarBg]);
  const lansAmountEnabled = useMemo(() => lansOcrDigits !== "", [lansOcrDigits]);
  const lansNeedsOcr = useMemo(() => includeLans && run.lans_amount > 0 && lansOcrDigits === "", [includeLans, run.lans_amount, lansOcrDigits]);
  const lansNeedsBg = useMemo(() => includeLans && run.lans_amount > 0 && lansBgDigits === "", [includeLans, run.lans_amount, lansBgDigits]);
  const lansReadyForPayments = useMemo(
    () => !includeLans || run.lans_amount === 0 || (lansOcrDigits !== "" && lansBgDigits !== ""),
    [includeLans, run.lans_amount, lansOcrDigits, lansBgDigits]
  );

  const salariesXml = useMemo(() => {
    if (!executionReady) return null;
    if (!agiReady) return null;
    try {
      return buildSalariesXml(profile, run);
    } catch (e: any) {
      return null;
    }
  }, [profile, run, executionReady, agiReady]);

  const paymentsResult = useMemo(() => {
    if (!executionReady) return { xml: null as string | null, error: null as string | null };
    if (!agiReady) return { xml: null as string | null, error: null as string | null };
    if (!momsReady) return { xml: null as string | null, error: null as string | null };
    try {
      const xml = buildPaymentsXml(profile, run);
      if (!xml && tele2NeedsOcr) return { xml: null as string | null, error: "Tele2 OCR is required when Tele2 amount > 0." };
      if (!xml && tele2NeedsBg) return { xml: null as string | null, error: "Tele2 BG is required in Profile when Tele2 amount > 0." };
      if (!xml && dnbNeedsOcr) return { xml: null as string | null, error: "DNB OCR is required when DNB amount > 0." };
      if (!xml && dnbNeedsBg) return { xml: null as string | null, error: "DNB BG is required in Profile when DNB amount > 0." };
      if (!xml && lansNeedsBg) return { xml: null as string | null, error: "Länsförsäkringar BG is required in Profile when Länsförsäkringar amount > 0." };
      if (!xml && lansNeedsOcr) return { xml: null as string | null, error: "Länsförsäkringar OCR is required when Länsförsäkringar amount > 0." };
      return { xml, error: null as string | null };
    } catch (e: any) {
      return { xml: null as string | null, error: e?.message ? String(e.message) : "Failed to build payments XML." };
    }
  }, [profile, run, executionReady, agiReady, momsReady, tele2NeedsOcr, tele2NeedsBg, dnbNeedsOcr, dnbNeedsBg, lansNeedsBg, lansNeedsOcr]);

  const netAb = useMemo(() => run.salary_ab + run.adj_ab, [run.salary_ab, run.adj_ab]);
  const netAn = useMemo(() => run.salary_an + run.adj_an, [run.salary_an, run.adj_an]);

  const outputs = useMemo(() => {
    const salaryTx = (netAb > 0 ? 1 : 0) + (netAn > 0 ? 1 : 0);
    const paymentsTx =
      (run.agi > 0 ? 1 : 0) +
      (run.avdragen_skatt > 0 ? 1 : 0) +
      (includeMoms && run.moms > 0 ? 1 : 0) +
      (run.tele2_amount > 0 ? 1 : 0) +
      (run.dnb_amount > 0 ? 1 : 0) +
      (includeLans && run.lans_amount > 0 ? 1 : 0);

    const salarySum = netAb + netAn;
    const paymentsSum = run.agi + run.avdragen_skatt + (includeMoms ? run.moms : 0) + run.tele2_amount + run.dnb_amount + (includeLans ? run.lans_amount : 0);

    return { salaryTx, paymentsTx, salarySum, paymentsSum };
  }, [run, includeMoms, includeLans, netAb, netAn]);

  function setField<K extends keyof RunInput>(key: K, value: RunInput[K]) {
    setRun((r) => ({ ...r, [key]: value }));
  }

  function openDatePicker() {
    const el = dateRef.current as any;
    if (el && typeof el.showPicker === "function") el.showPicker();
  }

  function onPickExecutionDate(next: string) {
    if (next && !isPreferredExecutionDate(next)) {
      const ok = window.confirm("Execution date is usually 22, 23, or 24. Do you want to continue with this date?");
      if (!ok) return;
      setStatus({ kind: "warn", text: `Non-standard execution date selected: ${next}.` });
    }
    setField("executionDate", next);
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

    const errors: string[] = [];
    const info: string[] = [];
    if (!hasProfile) errors.push("Profile incomplete");
    if (!azimId) errors.push("Azim personnummer not configured in Profile");
    else if (!az) info.push("Azim not found in AGI — no salary this period");
    if (!aynunId) errors.push("Aynun personnummer not configured in Profile");
    else if (!an) info.push("Aynun not found in AGI — no salary this period");

    setRun((r) => ({
      ...r,
      salary_ab: az ? az.gross - az.tax : 0,
      salary_an: an ? an.gross - an.tax : 0,
      agi: parsed.totalsAgi,
      avdragen_skatt: parsed.totalsAvdragenSkatt,
    }));

    const periodStr = parsed.period ?? "?";
    if (errors.length) {
      setStatus({ kind: "warn", text: `AGI loaded (period ${periodStr}), but: ${errors.join("; ")}.` });
    } else if (info.length) {
      setStatus({ kind: "ok", text: `AGI loaded (period ${periodStr}). ${info.join(". ")}.` });
    } else {
      setStatus({ kind: "ok", text: `AGI loaded (period ${periodStr}). Salaries + AGI + Avdragen skatt filled.` });
    }
  }

  async function onPickMoms(file: File | null) {
    if (!file) return;

    const xmlText = await file.text();
    const parsed = parseMomsXml(xmlText);

    setMomsMeta({ fileName: file.name, period: parsed.period, orgNr: parsed.orgNr });

    setRun((r) => ({
      ...r,
      moms: parsed.momsBetala,
    }));

    const orgNr10 = parsed.orgNr ? digits(parsed.orgNr).slice(-10) : "";
    const senderDigits = digits(profile.senderId);
    const senderOrgNr10 = senderDigits.slice(0, 10);

    if (orgNr10 && senderOrgNr10 && orgNr10 !== senderOrgNr10) {
      setStatus({
        kind: "warn",
        text: `MOMS loaded (period ${parsed.period ?? "?"}), but OrgNr mismatch: file ${orgNr10} vs senderId(orgnr) ${senderOrgNr10}.`,
      });
    } else {
      setStatus({ kind: "ok", text: `MOMS loaded (period ${parsed.period ?? "?"}). Filled MOMS (MomsBetala).` });
    }
  }

  function reset() {
    setRun({ ...RUN_DEFAULT });
    setStatus(null);
    setAgiMeta(null);
    setIncludeAdjAb(false);
    setIncludeAdjAn(false);
    setAdjAbText("");
    setAdjAnText("");
    setIncludeMoms(false);
    setMomsMeta(null);
    setIncludeLans(false);
  }

  function downloadSalaries() {
    if (!salariesXml) return;
    downloadTextFile(`${run.executionDate}-salaries.xml`, minifyXml(salariesXml));
  }

  function downloadPayments() {
    if (!paymentsResult.xml) return;
    downloadTextFile(`${run.executionDate}-payments.xml`, minifyXml(paymentsResult.xml));
  }

  function saveToHistory() {
    const sal = salariesXml ? minifyXml(salariesXml) : null;
    const pay = paymentsResult.xml ? minifyXml(paymentsResult.xml) : null;
    const entry = makeHistoryEntry(run, sal, pay, agiMeta?.period);
    onSaveHistory(entry);
    setStatus({ kind: "ok", text: "Saved to history." });
  }

  const paymentsDisabled =
    !executionReady ||
    !agiReady ||
    !momsReady ||
    !paymentsResult.xml ||
    tele2MissingForPayments ||
    dnbMissingForPayments ||
    !lansReadyForPayments;

  return (
    <div className="card">
      <style>{`
        .dateInput { color-scheme: dark; cursor: pointer; }
        .dateInput::-webkit-calendar-picker-indicator { filter: invert(1); opacity: .9; }
      `}</style>

      {status?.kind === "warn" && <div className="small warn">{status.text}</div>}
      {status?.kind === "ok" && <div className="small ok">{status.text}</div>}
      {paymentsResult.error && <div className="small warn">{paymentsResult.error}</div>}

      {!executionReady && <div className="small warn">Execution date is required.</div>}
      {!agiReady && <div className="small warn">AGI XML is required.</div>}
      {includeMoms && !momsMeta && <div className="small warn">MOMS XML is required when MOMS is added.</div>}

      <div className="row">
        <div className="col">
          <h2 className="h">NEW RUN</h2>

          <label>EXECUTION DATE</label>
          <input
            ref={dateRef}
            className="dateInput"
            type="date"
            value={run.executionDate}
            onClick={openDatePicker}
            onFocus={openDatePicker}
            onChange={(e) => onPickExecutionDate(e.target.value)}
          />

          <label>LOAD AGI XML</label>
          <input type="file" accept=".xml" onChange={(e) => onPickAgi(e.target.files?.[0] ?? null)} />
          {agiMeta && <div className="small">AGI: {agiMeta.fileName}{agiMeta.period ? ` (period ${agiMeta.period})` : ""}</div>}

          <hr />

          <h3 className="h3">SALARIES</h3>

          <label>AZIM SALARY (AGI: gross − tax)</label>
          <input disabled value={fmtInputNumber(run.salary_ab)} inputMode="decimal" />

          {!includeAdjAb ? (
            <button onClick={() => setIncludeAdjAb(true)}>Add Azim net adjustment</button>
          ) : (
            <>
              <div className="btnRow" style={{ marginTop: 0 }}>
                <button
                  className="danger"
                  onClick={() => {
                    setIncludeAdjAb(false);
                    setAdjAbText("");
                    setRun((r) => ({ ...r, adj_ab: 0 }));
                  }}
                >
                  Remove Azim net adjustment
                </button>
              </div>

              <label>AZIM NET ADJUSTMENT (payslip, e.g. skuld/förmån)</label>
              <input
                value={adjAbText}
                placeholder="0 (e.g. -2128)"
                onChange={(e) => {
                  setAdjAbText(e.target.value);
                  setField("adj_ab", toNumber(e.target.value));
                }}
                inputMode="decimal"
              />

              <label>AZIM NET TO PAY</label>
              <input disabled value={fmtInputNumber(netAb)} inputMode="decimal" />
            </>
          )}

          <label>AYNUN SALARY (AGI: gross − tax)</label>
          <input disabled value={fmtInputNumber(run.salary_an)} inputMode="decimal" />

          {!includeAdjAn ? (
            <button onClick={() => setIncludeAdjAn(true)}>Add Aynun net adjustment</button>
          ) : (
            <>
              <div className="btnRow" style={{ marginTop: 0 }}>
                <button
                  className="danger"
                  onClick={() => {
                    setIncludeAdjAn(false);
                    setAdjAnText("");
                    setRun((r) => ({ ...r, adj_an: 0 }));
                  }}
                >
                  Remove Aynun net adjustment
                </button>
              </div>

              <label>AYNUN NET ADJUSTMENT (payslip, e.g. skuld/förmån)</label>
              <input
                value={adjAnText}
                placeholder="0 (e.g. -6458)"
                onChange={(e) => {
                  setAdjAnText(e.target.value);
                  setField("adj_an", toNumber(e.target.value));
                }}
                inputMode="decimal"
              />

              <label>AYNUN NET TO PAY</label>
              <input disabled value={fmtInputNumber(netAn)} inputMode="decimal" />
            </>
          )}

          <hr />

          <h3 className="h3">SKATTEVERKET</h3>

          <label>AVDRAGEN SKATT</label>
          <input disabled value={fmtInputNumber(run.avdragen_skatt)} inputMode="decimal" />

          <label>ARBETSGIVARAVGIFT</label>
          <input disabled value={fmtInputNumber(run.agi)} inputMode="decimal" />

          <hr />

          <h3 className="h3">MOMS</h3>

          {!includeMoms ? (
            <button
              onClick={() => {
                setIncludeMoms(true);
                setMomsMeta(null);
                setRun((r) => ({ ...r, moms: 0 }));
              }}
            >
              Add MOMS
            </button>
          ) : (
            <>
              <div className="btnRow" style={{ marginTop: 0 }}>
                <button
                  className="danger"
                  onClick={() => {
                    setIncludeMoms(false);
                    setMomsMeta(null);
                    setRun((r) => ({ ...r, moms: 0 }));
                  }}
                >
                  Remove MOMS
                </button>
              </div>

              <label>LOAD MOMS XML</label>
              <input type="file" accept=".xml" onChange={(e) => onPickMoms(e.target.files?.[0] ?? null)} />
              {momsMeta && <div className="small">MOMS: {momsMeta.fileName}{momsMeta.period ? ` (period ${momsMeta.period})` : ""}</div>}

              <label>MOMS (from XML)</label>
              <input disabled value={fmtInputNumber(run.moms)} inputMode="decimal" />
            </>
          )}

          <hr />

          <h3 className="h3">TELE2</h3>

          <label>TELE2 OCR</label>
          <input value={run.tele2_ocr} placeholder="Digits only" onChange={(e) => setField("tele2_ocr", e.target.value)} />

          <label>TELE2 AMOUNT</label>
          <input
            disabled={!tele2AmountEnabled}
            value={fmtInputNumber(run.tele2_amount)}
            onChange={(e) => setField("tele2_amount", toNumber(e.target.value))}
            inputMode="decimal"
          />

          <hr />

          <h3 className="h3">DNB</h3>

          <label>DNB OCR</label>
          <input value={run.dnb_ocr} placeholder="Digits only" onChange={(e) => setField("dnb_ocr", e.target.value)} />

          <label>DNB AMOUNT</label>
          <input
            disabled={!dnbAmountEnabled}
            value={fmtInputNumber(run.dnb_amount)}
            onChange={(e) => setField("dnb_amount", toNumber(e.target.value))}
            inputMode="decimal"
          />

          <hr />

          <h3 className="h3">LÄNSFÖRSÄKRINGAR</h3>

          {!includeLans ? (
            <button
              onClick={() => {
                setIncludeLans(true);
                setRun((r) => ({ ...r, lans_amount: 0, lans_ocr: "" }));
              }}
            >
              Add Länsförsäkringar
            </button>
          ) : (
            <>
              <div className="btnRow" style={{ marginTop: 0 }}>
                <button
                  className="danger"
                  onClick={() => {
                    setIncludeLans(false);
                    setRun((r) => ({ ...r, lans_amount: 0, lans_ocr: "" }));
                  }}
                >
                  Remove Länsförsäkringar
                </button>
              </div>

              <label>LÄNSFÖRSÄKRINGAR OCR</label>
              <input value={run.lans_ocr} placeholder="Digits only" onChange={(e) => setField("lans_ocr", e.target.value)} />

              <label>LÄNSFÖRSÄKRINGAR AMOUNT</label>
              <input
                disabled={!lansAmountEnabled}
                value={fmtInputNumber(run.lans_amount)}
                onChange={(e) => setField("lans_amount", toNumber(e.target.value))}
                inputMode="decimal"
              />
            </>
          )}
        </div>

        <div className="col">
          <h2 className="h">OUTPUTS</h2>

          <div className="small">
            SALARIES: {outputs.salaryTx} tx — {fmtSek(outputs.salarySum)} SEK
            <br />
            PAYMENTS: {outputs.paymentsTx} tx — {fmtSek(outputs.paymentsSum)} SEK
          </div>

          <div className="btnRow">
            <button className="primary" onClick={downloadSalaries} disabled={!executionReady || !agiReady || !salariesXml}>
              DOWNLOAD SALARIES
            </button>
            <button className="primary" onClick={downloadPayments} disabled={paymentsDisabled}>
              DOWNLOAD PAYMENTS
            </button>
          </div>

          <div className="btnRow">
            <button onClick={saveToHistory} disabled={!executionReady || !agiReady || (includeMoms && !momsMeta)}>
              SAVE TO HISTORY
            </button>
            <button className="danger" onClick={reset}>
              RESET
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

          {tele2MissingForPayments && (
            <div className="small warn" style={{ marginTop: 12 }}>
              Payments download is disabled until <b>Tele2 amount</b> + <b>Tele2 OCR</b> are provided.
            </div>
          )}

          {tele2NeedsBg && (
            <div className="small warn" style={{ marginTop: 12 }}>
              Tele2 BG is required in <b>Profile</b>.
            </div>
          )}

          {tele2NeedsOcr && (
            <div className="small warn" style={{ marginTop: 12 }}>
              Tele2 OCR is required when Tele2 amount &gt; 0.
            </div>
          )}

          {dnbMissingForPayments && (
            <div className="small warn" style={{ marginTop: 12 }}>
              Payments download is disabled until <b>DNB amount</b> + <b>DNB OCR</b> are provided.
            </div>
          )}

          {dnbNeedsBg && (
            <div className="small warn" style={{ marginTop: 12 }}>
              DNB BG is required in <b>Profile</b>.
            </div>
          )}

          {dnbNeedsOcr && (
            <div className="small warn" style={{ marginTop: 12 }}>
              DNB OCR is required when DNB amount &gt; 0.
            </div>
          )}

          {includeLans && lansNeedsBg && (
            <div className="small warn" style={{ marginTop: 12 }}>
              Länsförsäkringar BG is required in <b>Profile</b> when Länsförsäkringar amount &gt; 0.
            </div>
          )}

          {includeLans && lansNeedsOcr && (
            <div className="small warn" style={{ marginTop: 12 }}>
              Länsförsäkringar OCR is required when Länsförsäkringar amount &gt; 0.
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
