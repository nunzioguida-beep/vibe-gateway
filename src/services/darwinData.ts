export interface TesterData {
  name: string;
  email: string;
  plan: string;
  favoriteGym: string | null;
  activeFM: number;
  fmFreeSlots: number;
  checkInMay: number;
  checkInJune: number;
  fmName?: string;
  fmPlan?: string;
  fmGym?: string | null;
  accountNotes?: string;
  suggestedPartner?: string;
}

// Keyed by phone number WITHOUT leading +
const TESTER_DATA: Record<string, TesterData> = {
  "393357295306": { name: "Nunzio",   email: "nunzio.guida@gympass.com",      plan: "Gold",      favoriteGym: "Energie Fitness",              activeFM: 1, fmFreeSlots: 2, checkInMay: 20, checkInJune: 1  },
  "19178901779":   { name: "Cesar",   email: "cesar@gympass.com",             plan: "Diamond",   favoriteGym: "F45",                          activeFM: 1, fmFreeSlots: 2, checkInMay: 6,  checkInJune: 0, fmName: "Ana Karla Nogueira Carvalho", fmPlan: "Platinum", fmGym: "Solidcore", accountNotes: "Account in good standing — no fraud cases and no late cancellation / no-show records.", suggestedPartner: "Orangetheory Fitness - Danbury East, CT (functional-style training similar to F45, located in their area)" },
  "34618633099":   { name: "Thiago",  email: "thiago.pessoa@gympass.com",     plan: "Gold",      favoriteGym: null,                           activeFM: 1, fmFreeSlots: 2, checkInMay: 0,  checkInJune: 0  },
  "19739979012":   { name: "Gustavo", email: "gustavo.ramos@gympass.com",     plan: "Gold",      favoriteGym: "Montville Pickleball & Golf Club", activeFM: 2, fmFreeSlots: 1, checkInMay: 15, checkInJune: 0  },
  // "55XXXXXXXXXX":  { name: "Bruno",   email: "bruno.annicq@gympass.com",      plan: "Gold",      favoriteGym: null,                           activeFM: 1, fmFreeSlots: 2, checkInMay: 0,  checkInJune: 0  },
  // "1XXXXXXXXXX":   { name: "Ellen",   email: "ellen.hochberg@gympass.com",    plan: "Gold",      favoriteGym: "Solidcore W 57",               activeFM: 0, fmFreeSlots: 3, checkInMay: 17, checkInJune: 0  },
  // "1XXXXXXXXXX":   { name: "Carolee", email: "carolee.gearhart@gympass.com",  plan: "Platinum",  favoriteGym: "Monterey Core Fitness",        activeFM: 0, fmFreeSlots: 3, checkInMay: 4,  checkInJune: 0  },
  // "55XXXXXXXXXX":  { name: "Eduardo", email: "eduardo.baer@gympass.com",      plan: "Gold+",     favoriteGym: null,                           activeFM: 0, fmFreeSlots: 3, checkInMay: 0,  checkInJune: 0  },
  // "55XXXXXXXXXX":  { name: "Daniel",  email: "daniel.mazini@gympass.com",     plan: "Diamond+",  favoriteGym: "Bodytech",                     activeFM: 0, fmFreeSlots: 3, checkInMay: 4,  checkInJune: 0  },
  // "55XXXXXXXXXX":  { name: "Victor",  email: "vribeiro@gmail.com",            plan: "Platinum",  favoriteGym: null,                           activeFM: 0, fmFreeSlots: 3, checkInMay: 0,  checkInJune: 0  },
  // "XXXXXXXXXXX":   { name: "Livia",   email: "liviamartini@gmail.com",        plan: "Diamond+",  favoriteGym: "Reebok Sport Club",            activeFM: 2, fmFreeSlots: 1, checkInMay: 6,  checkInJune: 0  },
};

// Approved emails for access verification (all 10 testers)
const APPROVED_EMAILS = new Set<string>([
  "nunzio.guida@gympass.com",
  "cesar@gympass.com",
  "thiago.pessoa@gympass.com",
  "gustavo.ramos@gympass.com",
  "bruno.annicq@gympass.com",
  "ellen.hochberg@gympass.com",
  "carolee.gearhart@gympass.com",
  "eduardo.baer@gympass.com",
  "daniel.mazini@gympass.com",
  "vribeiro@gmail.com",
  "liviamartini@gmail.com",
]);

// Gympass and Wellhub are the same company (rebranding), so the two corporate
// domains are interchangeable: a tester may type @wellhub.com or @gympass.com.
// Canonicalize to @gympass.com before any comparison. Other domains (e.g. gmail)
// are left untouched.
function normalizeEmail(email: string): string {
  return email.toLowerCase().trim().replace(/@wellhub\.com$/, "@gympass.com");
}

// Approved emails, canonicalized so wellhub.com / gympass.com both match.
const APPROVED_EMAILS_NORMALIZED = new Set<string>(
  [...APPROVED_EMAILS].map(normalizeEmail)
);

// Keyed by canonicalized email for lookup after email verification
const TESTER_BY_EMAIL: Record<string, TesterData> = {};
for (const d of Object.values(TESTER_DATA)) {
  TESTER_BY_EMAIL[normalizeEmail(d.email)] = d;
}

export function getTesterData(phoneNumber: string): TesterData | null {
  const normalized = phoneNumber.replace(/^\+/, "");
  return TESTER_DATA[normalized] ?? null;
}

export function getTesterByEmail(email: string): TesterData | null {
  return TESTER_BY_EMAIL[normalizeEmail(email)] ?? null;
}

export function isApprovedEmail(email: string): boolean {
  return APPROVED_EMAILS_NORMALIZED.has(normalizeEmail(email));
}
