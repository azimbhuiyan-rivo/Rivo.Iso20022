# Rivo ISO 20022 Generator (pain.001)

A small, local, browser-based tool to generate **ISO 20022 payment files (pain.001.001.03)** for Swedish business banking (e.g. SEB import).

It focuses on the monthly routine for a Swedish AB:
- **Salaries file** (one credit transfer per employee)
- **Payments file** (Skatteverket, Tele2, DNB, Länsförsäkringar — Bankgiro + OCR)
- **AGI XML import** to prefill salary + tax amounts
- Optional **MOMS XML import** to prefill VAT
> Everything runs **client-side only**. No backend. Data is stored in your browser’s `localStorage`.

## What it generates
From **New Run**, the app generates two XML files:
1) **Salaries**
- File name: `<executionDate>-salaries.xml`
- One transaction per employee (clearing + account)
- Employees with 0 salary (not in AGI that period) are automatically skipped
- Batch header is based on your saved Profile
2) **Payments**
- File name: `<executionDate>-payments.xml`
- Supports:
  - **Skatteverket** — Arbetsgivaravgift, Avdragen skatt, MOMS (Bankgiro + OCR)
  - **Tele2** (Bankgiro + OCR) — mandatory
  - **DNB** (Bankgiro + OCR) — mandatory, monthly
  - **Länsförsäkringar** (Bankgiro + OCR) — optional, half-yearly

Schema used in XML:
- `urn:iso:std:iso:20022:tech:xsd:pain.001.001.03`

## App structure
- **Profile**
  - Company/initiator + debtor account settings (IBAN/BIC)
  - Default payees (Skatteverket BG/OCR, Tele2 BG, DNB BG, Länsförsäkringar BG)
  - Employees registry (personnummer → clearing+account)
- **New Run**
  - Pick execution date (typically 22–24 of the month)
  - Upload **AGI XML** to auto-fill salary + tax values
  - (Optional) upload **MOMS XML** to auto-fill VAT
  - Enter OCR + amount for Tele2, DNB, and optionally Länsförsäkringar
  - Download the two generated XML files
- **History**
  - Stores runs locally
  - Re-download previously generated files

## AGI XML import (optional)
On **New Run**, you can upload an AGI XML file and the tool will:
- Match employees by **personnummer**
- Prefill per-employee values like:
  - `KontantBruttoErsattning`
  - `AvdrPrelSkatt`
- Prefill employer-level totals like:
  - total withheld tax / employer fees (depending on the XML content)

Notes:
- The import expects an XML structure compatible with Skatteverket AGI export (parsed via `DOMParser`).
- If an employee’s personnummer is configured in Profile but not found in the AGI XML (e.g. not taking salary that month), their salary is set to 0 and an informational note is shown (not a warning).
- If a personnummer is not configured in Profile at all, a warning is shown.

## How to use (monthly flow)
1) Go to **Profile**
   - Fill:
     - Initiator name
     - Sender ID + scheme
     - Debtor IBAN + BIC
     - Skatteverket Bankgiro + default OCR
     - Tele2 Bankgiro
     - DNB Bankgiro
     - (Optional) Länsförsäkringar Bankgiro
   - Add employees:
     - Personnummer, clearing+account
2) Go to **New Run**
   - Pick **Execution date** (the date SEB debits your corporate account — typically 22–24). Tip: if you want salary visible on day D, set execution date to D-1 banking day.
   - Upload **AGI XML** to prefill salaries + tax
   - (Optional) Upload **MOMS XML** to prefill VAT
   - Enter OCR + amount for Tele2 and DNB (mandatory), Länsförsäkringar (optional)
   - Download:
     - `<executionDate>-salaries.xml`
     - `<executionDate>-payments.xml`
3) Import into your bank
   - Import the salary file where your bank expects payroll/salary ISO20022
   - Import the payments file where your bank expects payments ISO20022
> Always verify totals and references (especially OCR) in the bank UI before signing.

## Data & security
- All data is stored in **browser localStorage**
  - Profile
  - Employees list
  - Run history
- Clearing browser storage resets the app state.

## Development
### Prereqs
- Node.js 18+ recommended
### Install & run
```bash
npm install
npm run dev
````
### Build
```bash
npm run build
npm run preview
```

## Customization
Main logic lives in:
* `src/lib/pain001.ts` (XML generation)
* `src/lib/agi.ts` (AGI XML parsing)
* `src/lib/moms.ts` (MOMS XML parsing)
* `src/lib/types.ts` (Profile + RunInput types)
* `src/lib/storage.ts` (localStorage persistence)
* `src/pages/NewRunPage.tsx` (run UI + download)

To add new payment types (e.g. extra Bankgiro payees):
* Extend the inputs in `types.ts` / Profile
* Update `buildPaymentsXml(...)` in `pain001.ts`
* Update `NewRunPage` UI

## Disclaimer
This tool is a convenience generator and does not guarantee bank acceptance in all scenarios.
You are responsible for validating the generated files and ensuring correctness before payment execution.
