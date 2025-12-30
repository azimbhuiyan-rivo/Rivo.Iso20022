# Rivo ISO 20022 Generator (pain.001)

A small, local, browser-based tool to generate **ISO 20022 payment files (pain.001.001.03)** for Swedish business banking (e.g. SEB import).

It focuses on the monthly routine for a Swedish AB:
- **Salaries file** (one credit transfer per employee)
- **Payments file** (e.g. Skatteverket + Tele2 / Bankgiro + OCR)
- Optional **AGI XML import** to prefill salary + tax amounts
> Everything runs **client-side only**. No backend. Data is stored in your browser’s `localStorage`.

## What it generates
From **New Run**, the app generates two XML files:
1) **Salaries**
- File name: `ISO20022-Salaries-<executionDate>-<runId>.xml`
- One transaction per employee (IBAN/BIC)
- Batch header is based on your saved Profile
2) **Payments**
- File name: `ISO20022-Payments-<executionDate>-<runId>.xml`
- Supports:
  - **Skatteverket** (Bankgiro + OCR reference)
  - **Tele2** (Bankgiro + OCR reference)
- (The current implementation builds a single batch with multiple CdtTrfTxInf entries.)

Schema used in XML:
- `urn:iso:std:iso:20022:tech:xsd:pain.001.001.03`

## App structure
- **Profile**
  - Company/initiator + debtor account settings (IBAN/BIC)
  - Default payees (Skatteverket BG/OCR, Tele2 BG)
  - Employees registry (personnummer → IBAN/BIC + name)
- **New Run**
  - Create a run label + execution date
  - (Optional) upload **AGI XML** to auto-fill salary + tax values
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
- If an employee isn’t found in your Profile mapping, they’ll be skipped (so keep your registry updated).

## How to use (monthly flow)
1) Go to **Profile**
   - Fill:
     - Initiator name
     - Sender ID + scheme
     - Debtor IBAN + BIC
     - Skatteverket Bankgiro + default OCR
     - Tele2 Bankgiro
   - Add employees:
     - Name, Personnummer, IBAN, BIC
2) Go to **New Run**
   - Set a label (e.g. `Jan 2026 payroll`)
   - Pick **Execution date**
   - (Optional) Upload **AGI XML** to prefill
   - Verify/adjust amounts
   - Download:
     - `ISO20022-Salaries-...xml`
     - `ISO20022-Payments-...xml`
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
* `src/lib/storage.ts` (localStorage persistence)
* `src/pages/NewRunPage.tsx` (run UI + download)

To add new payment types (e.g. extra Bankgiro payees):
* Extend the inputs in `types.ts` / Profile
* Update `buildPaymentsXml(...)` in `pain001.ts`
* Update `NewRunPage` UI

## Disclaimer
This tool is a convenience generator and does not guarantee bank acceptance in all scenarios.
You are responsible for validating the generated files and ensuring correctness before payment execution.
