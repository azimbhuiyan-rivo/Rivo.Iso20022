import { useMemo, useRef, useState } from "react";
import type { Profile, RunInput } from "../lib/types";
import { parseAgiXml } from "../lib/agi";
import { parseMomsXml } from "../lib/moms";
import { buildPaymentsXml, buildSalariesXml, buildSkatteverketXml, digits } from "../lib/pain001";
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
  skvExecutionDate: "",
  paymentsExecutionDate: "",
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
  lans_foretag_amount: 0,
  lans_foretag_ocr: "",
  lans_bil_amount: 0,
  lans_bil_ocr: "",
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

function defaultSkvDate(executionDate: string): string {
  const parts = (executionDate ?? "").split("-");
  if (parts.length !== 3) return "";
  const d = new Date(Number(parts[0]), Number(parts[1]), 12);
  if (d.getDay() === 6) d.setDate(11);
  if (d.getDay() === 0) d.setDate(10);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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

  const [includeLansForetag, setIncludeLansForetag] = useState(false);
  const [includeLansBil, setIncludeLansBil] = useState(false);
  const [skvDateTouched, setSkvDateTouched] = useState(false);
  const [payDateTouched, setPayDateTouched] = useState(false);

  const dateRef = useRef<HTMLInputElement | null>(null);

  const executionReady = useMemo(() => Boolean(run.executionDate && run.executionDate.trim()), [run.executionDate]);
  const skvDateReady = useMemo(() => Boolean(run.skvExecutionDate && run.skvExecutionDate.trim()), [run.skvExecutionDate]);
  const payDateReady = useMemo(() => Boolean(run.paymentsExecutionDate && run.paymentsExecutionDate.trim()), [run.paymentsExecutionDate]);
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

  const lansForetagOcrDigits = useMemo(() => digits(run.lans_foretag_ocr), [run.lans_foretag_ocr]);
  const lansForetagBgDigits = useMemo(() => digits(profile.lansForetagBg ?? ""), [profile.lansForetagBg]);
  const lansForetagAmountEnabled = useMemo(() => lansForetagOcrDigits !== "", [lansForetagOcrDigits]);
  const lansForetagNeedsOcr = useMemo(() => includeLansForetag && run.lans_foretag_amount > 0 && lansForetagOcrDigits === "", [includeLansForetag, run.lans_foretag_amount, lansForetagOcrDigits]);
  const lansForetagNeedsBg = useMemo(() => includeLansForetag && run.lans_foretag_amount > 0 && lansForetagBgDigits === "", [includeLansForetag, run.lans_foretag_amount, lansForetagBgDigits]);

  const lansBilOcrDigits = useMemo(() => digits(run.lans_bil_ocr), [run.lans_bil_ocr]);
  const lansBilBgDigits = useMemo(() => digits(profile.lansBilBg ?? ""), [profile.lansBilBg]);
  const lansBilAmountEnabled = useMemo(() => lansBilOcrDigits !== "", [lansBilOcrDigits]);
  const lansBilNeedsOcr = useMemo(() => includeLansBil && run.lans_bil_amount > 0 && lansBilOcrDigits === "", [includeLansBil, run.lans_bil_amount, lansBilOcrDigits]);
  const lansBilNeedsBg = useMemo(() => includeLansBil && run.lans_bil_amount > 0 && lansBilBgDigits === "", [includeLansBil, run.lans_bil_amount, lansBilBgDigits]);

  const lansNeedsOcr = lansForetagNeedsOcr || lansBilNeedsOcr;
  const lansNeedsBg = lansForetagNeedsBg || lansBilNeedsBg;
  const lansReadyForPayments = !lansNeedsOcr && !lansNeedsBg;

  const salariesXml = useMemo(() => {
    if (!executionReady) return null;
    if (!agiReady) return null;
    try {
      return buildSalariesXml(profile, run);
    } catch (e: any) {
      return null;
    }
  }, [profile, run, executionReady, agiReady]);

  const skvXml = useMemo(() => {
    if (!executionReady) return null;
    if (!agiReady) return null;
    if (!momsReady) return null;
    if (!skvDateReady) return null;
    try {
      return buildSkatteverketXml(profile, run);
    } catch {
      return null;
    }
  }, [profile, run, executionReady, agiReady, momsReady, skvDateReady]);

  const paymentsResult = useMemo(() => {
    if (!executionReady) return { xml: null as string | null, error: null as string | null };
    if (!payDateReady) return { xml: null as string | null, error: null as string | null };
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
  }, [profile, run, executionReady, payDateReady, tele2NeedsOcr, tele2NeedsBg, dnbNeedsOcr, dnbNeedsBg, lansNeedsBg, lansNeedsOcr]);

  const netAb = useMemo(() => run.salary_ab + run.adj_ab, [run.salary_ab, run.adj_ab]);
  const netAn = useMemo(() => run.salary_an + run.adj_an, [run.salary_an, run.adj_an]);

  const outputs = useMemo(() => {
    const salaryTx = (netAb > 0 ? 1 : 0) + (netAn > 0 ? 1 : 0);
    const skvTx = (run.agi > 0 ? 1 : 0) + (run.avdragen_skatt > 0 ? 1 : 0) + (includeMoms && run.moms > 0 ? 1 : 0);
    const paymentsTx =
      (run.tele2_amount > 0 ? 1 : 0) +
      (run.dnb_amount > 0 ? 1 : 0) +
      (includeLansForetag && run.lans_foretag_amount > 0 ? 1 : 0) +
      (includeLansBil && run.lans_bil_amount > 0 ? 1 : 0);

    const salarySum = netAb + netAn;
    const skvSum = run.agi + run.avdragen_skatt + (includeMoms ? run.moms : 0);
    const paymentsSum = run.tele2_amount + run.dnb_amount + (includeLansForetag ? run.lans_foretag_amount : 0) + (includeLansBil ? run.lans_bil_amount : 0);

    return { salaryTx, skvTx, paymentsTx, salarySum, skvSum, paymentsSum };
  }, [run, includeMoms, includeLansForetag, includeLansBil, netAb, netAn]);

  function setField<K extends keyof RunInput>(key: K, value: RunInput[K]) {
    setRun((r) => ({ ...r, [key]: value }));
  }

  function openDatePicker() {
    showPicker(dateRef.current);
  }

  function showPicker(el: HTMLInputElement | null) {
    const picker = el as (HTMLInputElement & { showPicker?: () => void }) | null;
    if (picker && typeof picker.showPicker === "function") picker.showPicker();
  }

  function onPickExecutionDate(next: string) {
    if (next && !isPreferredExecutionDate(next)) {
      const ok = window.confirm("Execution date is usually 22, 23, or 24. Do you want to continue with this date?");
      if (!ok) return;
      setStatus({ kind: "warn", text: `Non-standard execution date selected: ${next}.` });
    }
    setRun((r) => ({
      ...r,
      executionDate: next,
      skvExecutionDate: skvDateTouched && r.skvExecutionDate ? r.skvExecutionDate : defaultSkvDate(next),
      paymentsExecutionDate: payDateTouched && r.paymentsExecutionDate ? r.paymentsExecutionDate : next,
    }));
  }

  function onPickSkvDate(next: string) {
    setSkvDateTouched(true);
    setField("skvExecutionDate", next);
  }

  function onPickPaymentsDate(next: string) {
    setPayDateTouched(true);
    setField("paymentsExecutionDate", next);
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
    setIncludeLansForetag(false);
    setIncludeLansBil(false);
    setSkvDateTouched(false);
    setPayDateTouched(false);
  }

  function downloadSalaries() {
    if (!salariesXml) return;
    downloadTextFile(`${run.executionDate}-salaries.xml`, minifyXml(salariesXml));
  }

  function downloadSkatteverket() {
    if (!skvXml) return;
    downloadTextFile(`${run.skvExecutionDate}-skatteverket.xml`, minifyXml(skvXml));
  }

  function downloadPayments() {
    if (!paymentsResult.xml) return;
    downloadTextFile(`${run.paymentsExecutionDate}-payments.xml`, minifyXml(paymentsResult.xml));
  }

  function saveToHistory() {
    const sal = salariesXml ? minifyXml(salariesXml) : null;
    const skv = skvXml ? minifyXml(skvXml) : null;
    const pay = paymentsResult.xml ? minifyXml(paymentsResult.xml) : null;
    const entry = makeHistoryEntry(run, sal, skv, pay, agiMeta?.period);
    onSaveHistory(entry);
    setStatus({ kind: "ok", text: "Saved to history." });
  }

  const skvDisabled = !executionReady || !agiReady || !momsReady || !skvDateReady || !skvXml;

  const paymentsDisabled =
    !executionReady ||
    !payDateReady ||
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
      {executionReady && !skvDateReady && <div className="small warn">Skatteverket execution date is required.</div>}
      {executionReady && !payDateReady && <div className="small warn">Payments execution date is required.</div>}
      {!agiReady && <div className="small warn">AGI XML is required.</div>}
      {includeMoms && !momsMeta && <div className="small warn">MOMS XML is required when MOMS is added.</div>}

      <div className="row">
        <div className="col">
          <h2 className="h">NEW RUN</h2>

          <div className="section">
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
            {agiMeta && <div className="small" style={{ marginTop: 8 }}>AGI: {agiMeta.fileName}{agiMeta.period ? ` (period ${agiMeta.period})` : ""}</div>}
          </div>

          <div className="section">
            <h3 className="h3">SALARIES</h3>

            <div className="subsection">
              <h3 className="h3">AZIM</h3>

              <label>SALARY (AGI: gross − tax)</label>
              <input disabled value={fmtInputNumber(run.salary_ab)} inputMode="decimal" />

              {!includeAdjAb ? (
                <div className="btnRow">
                  <button onClick={() => setIncludeAdjAb(true)}>Add net adjustment</button>
                </div>
              ) : (
                <>
                  <div className="btnRow">
                    <button
                      className="danger"
                      onClick={() => {
                        setIncludeAdjAb(false);
                        setAdjAbText("");
                        setRun((r) => ({ ...r, adj_ab: 0 }));
                      }}
                    >
                      Remove net adjustment
                    </button>
                  </div>

                  <label>NET ADJUSTMENT (payslip, e.g. skuld/förmån)</label>
                  <input
                    value={adjAbText}
                    placeholder="0 (e.g. -2128)"
                    onChange={(e) => {
                      setAdjAbText(e.target.value);
                      setField("adj_ab", toNumber(e.target.value));
                    }}
                    inputMode="decimal"
                  />

                  <label>NET TO PAY</label>
                  <input disabled value={fmtInputNumber(netAb)} inputMode="decimal" />
                </>
              )}
            </div>

            <div className="subsection">
              <h3 className="h3">AYNUN</h3>

              <label>SALARY (AGI: gross − tax)</label>
              <input disabled value={fmtInputNumber(run.salary_an)} inputMode="decimal" />

              {!includeAdjAn ? (
                <div className="btnRow">
                  <button onClick={() => setIncludeAdjAn(true)}>Add net adjustment</button>
                </div>
              ) : (
                <>
                  <div className="btnRow">
                    <button
                      className="danger"
                      onClick={() => {
                        setIncludeAdjAn(false);
                        setAdjAnText("");
                        setRun((r) => ({ ...r, adj_an: 0 }));
                      }}
                    >
                      Remove net adjustment
                    </button>
                  </div>

                  <label>NET ADJUSTMENT (payslip, e.g. skuld/förmån)</label>
                  <input
                    value={adjAnText}
                    placeholder="0 (e.g. -6458)"
                    onChange={(e) => {
                      setAdjAnText(e.target.value);
                      setField("adj_an", toNumber(e.target.value));
                    }}
                    inputMode="decimal"
                  />

                  <label>NET TO PAY</label>
                  <input disabled value={fmtInputNumber(netAn)} inputMode="decimal" />
                </>
              )}
            </div>
          </div>

          <div className="section">
            <h3 className="h3">SKATTEVERKET</h3>

            <label>EXECUTION DATE (SKATTEVERKET, default 12th next month)</label>
            <input
              className="dateInput"
              type="date"
              value={run.skvExecutionDate}
              onClick={(e) => showPicker(e.currentTarget)}
              onFocus={(e) => showPicker(e.currentTarget)}
              onChange={(e) => onPickSkvDate(e.target.value)}
            />

            <label>AVDRAGEN SKATT</label>
            <input disabled value={fmtInputNumber(run.avdragen_skatt)} inputMode="decimal" />

            <label>ARBETSGIVARAVGIFT</label>
            <input disabled value={fmtInputNumber(run.agi)} inputMode="decimal" />

            <div className="subsection">
              <h3 className="h3">MOMS</h3>

              {!includeMoms ? (
                <div className="btnRow">
                  <button
                    onClick={() => {
                      setIncludeMoms(true);
                      setMomsMeta(null);
                      setRun((r) => ({ ...r, moms: 0 }));
                    }}
                  >
                    Add MOMS
                  </button>
                </div>
              ) : (
                <>
                  <div className="btnRow">
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
                  {momsMeta && <div className="small" style={{ marginTop: 8 }}>MOMS: {momsMeta.fileName}{momsMeta.period ? ` (period ${momsMeta.period})` : ""}</div>}

                  <label>MOMS (from XML)</label>
                  <input disabled value={fmtInputNumber(run.moms)} inputMode="decimal" />
                </>
              )}
            </div>
          </div>

          <div className="section">
            <h3 className="h3">PAYMENTS</h3>

            <label>EXECUTION DATE (PAYMENTS, default = salary date)</label>
            <input
              className="dateInput"
              type="date"
              value={run.paymentsExecutionDate}
              onClick={(e) => showPicker(e.currentTarget)}
              onFocus={(e) => showPicker(e.currentTarget)}
              onChange={(e) => onPickPaymentsDate(e.target.value)}
            />
          </div>

          <div className="section">
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
          </div>

          <div className="section">
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
          </div>

          <div className="section">
            <h3 className="h3">LÄNSFÖRSÄKRINGAR</h3>

            <div className="subsection">
              <h3 className="h3">FÖRETAGSFÖRSÄKRING</h3>

              {!includeLansForetag ? (
                <div className="btnRow">
                  <button
                    onClick={() => {
                      setIncludeLansForetag(true);
                      setRun((r) => ({ ...r, lans_foretag_amount: 0, lans_foretag_ocr: "" }));
                    }}
                  >
                    Add Företagsförsäkring
                  </button>
                </div>
              ) : (
                <>
                  <div className="btnRow">
                    <button
                      className="danger"
                      onClick={() => {
                        setIncludeLansForetag(false);
                        setRun((r) => ({ ...r, lans_foretag_amount: 0, lans_foretag_ocr: "" }));
                      }}
                    >
                      Remove Företagsförsäkring
                    </button>
                  </div>

                  <label>FÖRETAGSFÖRSÄKRING OCR</label>
                  <input value={run.lans_foretag_ocr} placeholder="Digits only" onChange={(e) => setField("lans_foretag_ocr", e.target.value)} />

                  <label>FÖRETAGSFÖRSÄKRING AMOUNT</label>
                  <input
                    disabled={!lansForetagAmountEnabled}
                    value={fmtInputNumber(run.lans_foretag_amount)}
                    onChange={(e) => setField("lans_foretag_amount", toNumber(e.target.value))}
                    inputMode="decimal"
                  />
                </>
              )}
            </div>

            <div className="subsection">
              <h3 className="h3">BILFÖRSÄKRING</h3>

              {!includeLansBil ? (
                <div className="btnRow">
                  <button
                    onClick={() => {
                      setIncludeLansBil(true);
                      setRun((r) => ({ ...r, lans_bil_amount: 0, lans_bil_ocr: "" }));
                    }}
                  >
                    Add Bilförsäkring
                  </button>
                </div>
              ) : (
                <>
                  <div className="btnRow">
                    <button
                      className="danger"
                      onClick={() => {
                        setIncludeLansBil(false);
                        setRun((r) => ({ ...r, lans_bil_amount: 0, lans_bil_ocr: "" }));
                      }}
                    >
                      Remove Bilförsäkring
                    </button>
                  </div>

                  <label>BILFÖRSÄKRING OCR</label>
                  <input value={run.lans_bil_ocr} placeholder="Digits only" onChange={(e) => setField("lans_bil_ocr", e.target.value)} />

                  <label>BILFÖRSÄKRING AMOUNT</label>
                  <input
                    disabled={!lansBilAmountEnabled}
                    value={fmtInputNumber(run.lans_bil_amount)}
                    onChange={(e) => setField("lans_bil_amount", toNumber(e.target.value))}
                    inputMode="decimal"
                  />
                </>
              )}
            </div>
          </div>
        </div>

        <div className="col">
          <h2 className="h">OUTPUTS</h2>

          <div className="small">
            SALARIES ({run.executionDate || "date?"}): {outputs.salaryTx} tx — {fmtSek(outputs.salarySum)} SEK
            <br />
            SKATTEVERKET ({run.skvExecutionDate || "date?"}): {outputs.skvTx} tx — {fmtSek(outputs.skvSum)} SEK
            <br />
            PAYMENTS ({run.paymentsExecutionDate || "date?"}): {outputs.paymentsTx} tx — {fmtSek(outputs.paymentsSum)} SEK
          </div>

          <div className="btnRow">
            <button className="primary" onClick={downloadSalaries} disabled={!executionReady || !agiReady || !salariesXml}>
              DOWNLOAD SALARIES
            </button>
            <button className="primary" onClick={downloadSkatteverket} disabled={skvDisabled}>
              DOWNLOAD SKATTEVERKET
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

          {lansForetagNeedsBg && (
            <div className="small warn" style={{ marginTop: 12 }}>
              Länsförsäkringar Företagsförsäkring BG is required in <b>Profile</b>.
            </div>
          )}

          {lansForetagNeedsOcr && (
            <div className="small warn" style={{ marginTop: 12 }}>
              Företagsförsäkring OCR is required when its amount &gt; 0.
            </div>
          )}

          {lansBilNeedsBg && (
            <div className="small warn" style={{ marginTop: 12 }}>
              Länsförsäkringar Bilförsäkring BG is required in <b>Profile</b>.
            </div>
          )}

          {lansBilNeedsOcr && (
            <div className="small warn" style={{ marginTop: 12 }}>
              Bilförsäkring OCR is required when its amount &gt; 0.
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
