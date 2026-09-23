import type { Profile, RunInput } from "./types";

const NS = "urn:iso:std:iso:20022:tech:xsd:pain.001.001.03";

type BgTx = { e2e: string; amount: number; ustrd: string; name: string; bg: string };

function esc(s: string): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function digits(s: string): string {
  return (s ?? "").replace(/\D/g, "");
}

function nowIsoWithOffset(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const tz = -d.getTimezoneOffset();
  const sign = tz >= 0 ? "+" : "-";
  const hh = pad(Math.floor(Math.abs(tz) / 60));
  const mm = pad(Math.abs(tz) % 60);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${hh}:${mm}`;
}

function amt(n: number): string {
  return n.toFixed(2);
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
}

function debtorBlock(p: Profile): string {
  return `
<Dbtr><Nm>${esc(p.initiatorName)}</Nm></Dbtr>
<DbtrAcct><Id><IBAN>${esc(p.debtorIban.replace(/\s+/g, "").toUpperCase())}</IBAN></Id></DbtrAcct>
<DbtrAgt><FinInstnId><BIC>${esc(p.debtorBic)}</BIC></FinInstnId></DbtrAgt>`;
}

function grpHdr(p: Profile, msgId: string, nbTxs: number, ctrlSum: number): string {
  return `<GrpHdr>
<MsgId>${esc(msgId)}</MsgId>
<CreDtTm>${esc(nowIsoWithOffset())}</CreDtTm>
<NbOfTxs>${nbTxs}</NbOfTxs>
<CtrlSum>${amt(ctrlSum)}</CtrlSum>
<InitgPty><Nm>${esc(p.initiatorName)}</Nm><Id><OrgId><Othr><Id>${esc(digits(p.senderId))}</Id><SchmeNm><Cd>${esc(p.senderScheme)}</Cd></SchmeNm><Issr>SEB</Issr></Othr></OrgId></Id></InitgPty>
</GrpHdr>`;
}

function splitClearingAccount(clearingAccount: string): { clearing: string; account: string } {
  const d = digits(clearingAccount);
  return { clearing: d.slice(0, 4), account: d.slice(4) };
}

function bgPmtInf(p: Profile, pmtInfId: string, executionDate: string, txs: BgTx[]): string {
  return `<PmtInf>
<PmtInfId>${esc(pmtInfId)}</PmtInfId>
<PmtMtd>TRF</PmtMtd>
<BtchBookg>true</BtchBookg>
<NbOfTxs>${txs.length}</NbOfTxs>
<CtrlSum>${amt(sum(txs.map((t) => t.amount)))}</CtrlSum>
<PmtTpInf><LclInstrm><Prtry>DO</Prtry></LclInstrm></PmtTpInf>
<ReqdExctnDt>${esc(executionDate)}</ReqdExctnDt>
${debtorBlock(p)}
<ChrgBr>SHAR</ChrgBr>
${txs
  .map(
    (t) => `<CdtTrfTxInf>
<PmtId><InstrId>${esc(t.e2e)}</InstrId><EndToEndId>${esc(t.e2e)}</EndToEndId></PmtId>
<Amt><InstdAmt Ccy="SEK">${amt(t.amount)}</InstdAmt></Amt>
<CdtrAgt><FinInstnId><ClrSysMmbId><ClrSysId><Cd>SESBA</Cd></ClrSysId><MmbId>9900</MmbId></ClrSysMmbId></FinInstnId></CdtrAgt>
<Cdtr><Nm>${esc(t.name)}</Nm></Cdtr>
<CdtrAcct><Id><Othr><Id>${esc(t.bg)}</Id><SchmeNm><Prtry>BGNR</Prtry></SchmeNm></Othr></Id></CdtrAcct>
<RmtInf><Ustrd>${esc(t.ustrd)}</Ustrd></RmtInf>
</CdtTrfTxInf>`
  )
  .join("")}
</PmtInf>`;
}

function document(p: Profile, msgId: string, txs: BgTx[], pmtInf: string): string {
  return `<?xml version='1.0' encoding='utf-8'?>
<Document xmlns="${NS}">
<CstmrCdtTrfInitn>
${grpHdr(p, msgId, txs.length, sum(txs.map((t) => t.amount)))}
${pmtInf}
</CstmrCdtTrfInitn>
</Document>`;
}

export function buildSalariesXml(profile: Profile, run: RunInput): string | null {
  const txs: Array<{ name: string; clearing: string; account: string; amount: number; e2e: string }> = [];

  const netAb = run.salary_ab + run.adj_ab;
  const netAn = run.salary_an + run.adj_an;

  if (netAb > 0) {
    const { clearing, account } = splitClearingAccount(profile.employees.azim.clearingAccount);
    txs.push({ name: "Azim Bhuiyan", clearing, account, amount: netAb, e2e: `SAL-${run.executionDate}-EMP-AB` });
  }
  if (netAn > 0) {
    const { clearing, account } = splitClearingAccount(profile.employees.aynun.clearingAccount);
    txs.push({ name: "Aynun Nahar", clearing, account, amount: netAn, e2e: `SAL-${run.executionDate}-EMP-AN` });
  }

  if (txs.length === 0) return null;

  const ctrl = sum(txs.map((t) => t.amount));

  const body = txs
    .map(
      (t) => `<CdtTrfTxInf>
<PmtId><InstrId>${esc(t.e2e)}</InstrId><EndToEndId>${esc(t.e2e)}</EndToEndId></PmtId>
<Amt><InstdAmt Ccy="SEK">${amt(t.amount)}</InstdAmt></Amt>
<CdtrAgt><FinInstnId><ClrSysMmbId><ClrSysId><Cd>SESBA</Cd></ClrSysId><MmbId>${esc(t.clearing)}</MmbId></ClrSysMmbId></FinInstnId></CdtrAgt>
<Cdtr><Nm>${esc(t.name)}</Nm></Cdtr>
<CdtrAcct><Id><Othr><Id>${esc(t.account)}</Id><SchmeNm><Cd>BBAN</Cd></SchmeNm></Othr></Id></CdtrAcct>
<RmtInf><Ustrd>LÖN</Ustrd></RmtInf>
</CdtTrfTxInf>`
    )
    .join("");

  return `<?xml version='1.0' encoding='utf-8'?>
<Document xmlns="${NS}">
<CstmrCdtTrfInitn>
${grpHdr(profile, `RIVO-${run.executionDate}-SALARIES`, txs.length, ctrl)}
<PmtInf>
<PmtInfId>RIVO-${esc(run.executionDate)}-SALARIES</PmtInfId>
<PmtMtd>TRF</PmtMtd>
<BtchBookg>true</BtchBookg>
<NbOfTxs>${txs.length}</NbOfTxs>
<CtrlSum>${amt(ctrl)}</CtrlSum>
<PmtTpInf><CtgyPurp><Cd>SALA</Cd></CtgyPurp></PmtTpInf>
<ReqdExctnDt>${esc(run.executionDate)}</ReqdExctnDt>
${debtorBlock(profile)}
<ChrgBr>SHAR</ChrgBr>
${body}
</PmtInf>
</CstmrCdtTrfInitn>
</Document>`;
}

export function buildSkatteverketXml(profile: Profile, run: RunInput): string | null {
  const date = run.skvExecutionDate;
  if (!date) return null;
  const bg = digits(profile.skvBg);
  if (!bg) return null;
  const ocr = digits(profile.skvOcr);

  const txs: BgTx[] = [];
  if (run.agi > 0) txs.push({ e2e: `ARBETSGIVARAVGIFT-${date}`, amount: run.agi, ustrd: `Arbetsgivaravgift - ${date} OCR ${ocr}`, name: "Skatteverket", bg });
  if (run.avdragen_skatt > 0) txs.push({ e2e: `AVDRAGEN-SKATT-${date}`, amount: run.avdragen_skatt, ustrd: `SKATT - ${date} OCR ${ocr}`, name: "Skatteverket", bg });
  if (run.moms > 0) txs.push({ e2e: `MOMS-${date}`, amount: run.moms, ustrd: `MOMS - ${date} OCR ${ocr}`, name: "Skatteverket", bg });

  if (txs.length === 0) return null;

  return document(profile, `RIVO-${date}-SKATTEVERKET`, txs, bgPmtInf(profile, `RIVO-${date}-SKV`, date, txs));
}

export function buildPaymentsXml(profile: Profile, run: RunInput): string | null {
  const date = run.paymentsExecutionDate;
  if (!date) return null;

  const txs: BgTx[] = [];

  if (run.tele2_amount > 0) {
    const ocr = digits(run.tele2_ocr);
    if (!ocr) return null;
    const bg = digits(profile.tele2Bg);
    if (!bg) return null;
    txs.push({ e2e: `TELE2-${date}`, amount: run.tele2_amount, ustrd: `OCR ${ocr}`, name: "Tele2", bg });
  }

  if (run.dnb_amount > 0) {
    const ocr = digits(run.dnb_ocr);
    if (!ocr) return null;
    const bg = digits(profile.dnbBg);
    if (!bg) return null;
    txs.push({ e2e: `DNB-${date}`, amount: run.dnb_amount, ustrd: `OCR ${ocr}`, name: "DNB", bg });
  }

  if (run.transport_amount > 0) {
    const ocr = digits(run.transport_ocr);
    if (!ocr) return null;
    const bg = digits(profile.transportstyrelsenBg);
    if (!bg) return null;
    txs.push({ e2e: `TRANSPORTSTYRELSEN-${date}`, amount: run.transport_amount, ustrd: `OCR ${ocr}`, name: "Transportstyrelsen", bg });
  }

  if (run.lans_foretag_amount > 0) {
    const ocr = digits(run.lans_foretag_ocr);
    if (!ocr) return null;
    const bg = digits(profile.lansForetagBg);
    if (!bg) return null;
    txs.push({ e2e: `LANSF-FORETAG-${date}`, amount: run.lans_foretag_amount, ustrd: `OCR ${ocr}`, name: "Länsförsäkringar", bg });
  }

  if (run.lans_bil_amount > 0) {
    const ocr = digits(run.lans_bil_ocr);
    if (!ocr) return null;
    const bg = digits(profile.lansBilBg);
    if (!bg) return null;
    txs.push({ e2e: `LANSF-BIL-${date}`, amount: run.lans_bil_amount, ustrd: `OCR ${ocr}`, name: "Länsförsäkringar", bg });
  }

  if (txs.length === 0) return null;

  return document(profile, `RIVO-${date}-PAYMENTS`, txs, bgPmtInf(profile, `RIVO-${date}-VENDORS`, date, txs));
}
