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
  lansforsakringarBg: string;
  employees: {
    azim: EmployeeProfile;
    aynun: EmployeeProfile;
  };
};

export type RunInput = {
  executionDate: string;
  salary_ab: number;
  salary_an: number;
  avdragen_skatt: number;
  agi: number;
  moms: number;
  tele2_amount: number;
  tele2_ocr: string;
  lans_amount: number;
  lans_ocr: string;
};
