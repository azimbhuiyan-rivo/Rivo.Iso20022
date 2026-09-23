export type EmployeeProfile = {
  personnummer: string;
  clearingAccount: string;
};

export type Profile = {
  initiatorName: string;
  senderId: string;
  senderScheme: string;
  debtorIban: string;
  debtorBic: string;
  skvBg: string;
  skvOcr: string;
  tele2Bg: string;
  dnbBg: string;
  lansForetagBg: string;
  lansBilBg: string;
  transportstyrelsenBg: string;
  employees: {
    azim: EmployeeProfile;
    aynun: EmployeeProfile;
  };
};

export type RunInput = {
  executionDate: string;
  skvExecutionDate: string;
  paymentsExecutionDate: string;
  salary_ab: number;
  salary_an: number;
  adj_ab: number;
  adj_an: number;
  avdragen_skatt: number;
  agi: number;
  moms: number;
  tele2_amount: number;
  tele2_ocr: string;
  dnb_amount: number;
  dnb_ocr: string;
  lans_foretag_amount: number;
  lans_foretag_ocr: string;
  lans_bil_amount: number;
  lans_bil_ocr: string;
  transport_amount: number;
  transport_ocr: string;
};
