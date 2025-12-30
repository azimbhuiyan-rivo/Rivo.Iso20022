import type { Profile, RunInput } from "./types";

const NS = "urn:iso:std:iso:20022:tech:xsd:pain.001.001.03";

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

export function buildSalariesXml(profile: Profile, run: RunInput): string | null {
  const txs: Array<{ name: string; clearing: string; account: string; amount: number; e2e: string }> = [];

  if (run.salary_ab > 0) {
    const { clearing, account } = splitClearingAccount(profile.employees.azim.clearingAccount);
    txs.push({ name: "Azim Bhuiyan", clearing, account, amount: run.salary_ab, e2e: `SAL-${run.executionDate}-EMP-AB` });
  }
  if (run.salary_an > 0) {
    const { clearing, account } = splitClearingAccount(profile.employees.aynun.clearingAccount);
    txs.push({ name: "Aynun Nahar", clearing, account, amount: run.salary_an, e2e: `SAL-${run.executionDate}-EMP-AN` });
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

export function buildPaymentsXml(profile: Profile, run: RunInput): string | null {
  const skvTxs: Array<{ e2e: string; amount: number; ustrd: string }> = [];
  const vendorTxs: Array<{ e2e: string; amount: number; ustrd: string; name: string; bg: string }> = [];

  if (run.agi > 0) skvTxs.push({ e2e: `ARBETSGIVARAVGIFT-${run.executionDate}`, amount: run.agi, ustrd: `Arbetsgivaravgift - ${run.executionDate} OCR ${digits(profile.skvOcr)}` });
  if (run.avdragen_skatt > 0) skvTxs.push({ e2e: `AVDRAGEN-SKATT-${run.executionDate}`, amount: run.avdragen_skatt, ustrd: `SKATT - ${run.executionDate} OCR ${digits(profile.skvOcr)}` });
  if (run.moms > 0) skvTxs.push({ e2e: `MOMS-${run.executionDate}`, amount: run.moms, ustrd: `MOMS - ${run.executionDate} OCR ${digits(profile.skvOcr)}` });

  if (run.tele2_amount > 0) {
    const ocr = digits(run.tele2_ocr);
    if (!ocr) return null;
    const bg = digits(profile.tele2Bg);
    if (!bg) return null;
    vendorTxs.push({ e2e: `TELE2-${run.executionDate}`, amount: run.tele2_amount, ustrd: `OCR ${ocr}`, name: "Tele2", bg });
  }

  if (run.lans_amount > 0) {
    const ocr = digits(run.lans_ocr);
    if (!ocr) return null;
    const bg = digits(profile.lansforsakringarBg);
    if (!bg) return null;
    vendorTxs.push({ e2e: `LANSF-${run.executionDate}`, amount: run.lans_amount, ustrd: `OCR ${ocr}`, name: "Länsförsäkringar", bg });
  }

  const nbTxs = skvTxs.length + vendorTxs.length;
  if (nbTxs === 0) return null;

  const ctrl = sum([...skvTxs.map((t) => t.amount), ...vendorTxs.map((t) => t.amount)]);

  const skvBlock =
    skvTxs.length === 0
      ? ""
      : `<PmtInf>
<PmtInfId>RIVO-${esc(run.executionDate)}-SKV</PmtInfId>
<PmtMtd>TRF</PmtMtd>
<BtchBookg>true</BtchBookg>
<NbOfTxs>${skvTxs.length}</NbOfTxs>
<CtrlSum>${amt(sum(skvTxs.map((t) => t.amount)))}</CtrlSum>
<PmtTpInf><LclInstrm><Prtry>DO</Prtry></LclInstrm></PmtTpInf>
<ReqdExctnDt>${esc(run.executionDate)}</ReqdExctnDt>
${debtorBlock(profile)}
<ChrgBr>SHAR</ChrgBr>
${skvTxs
  .map(
    (t) => `<CdtTrfTxInf>
<PmtId><InstrId>${esc(t.e2e)}</InstrId><EndToEndId>${esc(t.e2e)}</EndToEndId></PmtId>
<Amt><InstdAmt Ccy="SEK">${amt(t.amount)}</InstdAmt></Amt>
<CdtrAgt><FinInstnId><ClrSysMmbId><ClrSysId><Cd>SESBA</Cd></ClrSysId><MmbId>9900</MmbId></ClrSysMmbId></FinInstnId></CdtrAgt>
<Cdtr><Nm>Skatteverket</Nm></Cdtr>
<CdtrAcct><Id><Othr><Id>${esc(digits(profile.skvBg))}</Id><SchmeNm><Prtry>BGNR</Prtry></SchmeNm></Othr></Id></CdtrAcct>
<RmtInf><Ustrd>${esc(t.ustrd)}</Ustrd></RmtInf>
</CdtTrfTxInf>`
  )
  .join("")}
</PmtInf>`;

  const vendorBlock =
    vendorTxs.length === 0
      ? ""
      : `<PmtInf>
<PmtInfId>RIVO-${esc(run.executionDate)}-VENDORS</PmtInfId>
<PmtMtd>TRF</PmtMtd>
<BtchBookg>true</BtchBookg>
<NbOfTxs>${vendorTxs.length}</NbOfTxs>
<CtrlSum>${amt(sum(vendorTxs.map((t) => t.amount)))}</CtrlSum>
<PmtTpInf><LclInstrm><Prtry>DO</Prtry></LclInstrm></PmtTpInf>
<ReqdExctnDt>${esc(run.executionDate)}</ReqdExctnDt>
${debtorBlock(profile)}
<ChrgBr>SHAR</ChrgBr>
${vendorTxs
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

  return `<?xml version='1.0' encoding='utf-8'?>
<Document xmlns="${NS}">
<CstmrCdtTrfInitn>
${grpHdr(profile, `RIVO-${run.executionDate}-PAYMENTS`, nbTxs, ctrl)}
${skvBlock}
${vendorBlock}
</CstmrCdtTrfInitn>
</Document>`;
}
