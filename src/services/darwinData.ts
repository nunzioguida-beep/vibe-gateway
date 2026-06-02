export interface TesterData {
  name: string;
  email: string;
  plan: string;
  favoriteGym: string | null;
  activeFM: number;
  fmFreeSlots: number;
  checkInMay: number;
  checkInJune: number;
}

// Keyed by phone number WITHOUT leading +
const TESTER_DATA: Record<string, TesterData> = {
  "393357295306": { name: "Nunzio",   email: "nunzio.guida@gympass.com",      plan: "Gold",      favoriteGym: "Energie Fitness",              activeFM: 1, fmFreeSlots: 2, checkInMay: 20, checkInJune: 1  },
  // "55XXXXXXXXXX":  { name: "Cesar",   email: "cesar@gympass.com",             plan: "Diamond",   favoriteGym: "F45",                          activeFM: 1, fmFreeSlots: 2, checkInMay: 6,  checkInJune: 0  },
  "34618633099":   { name: "Thiago",  email: "thiago.pessoa@gympass.com",     plan: "Gold",      favoriteGym: null,                           activeFM: 1, fmFreeSlots: 2, checkInMay: 0,  checkInJune: 0  },
  // "55XXXXXXXXXX":  { name: "Gustavo", email: "gustavo.ramos@gympass.com",     plan: "Gold",      favoriteGym: "Montville Pickleball & Golf Club", activeFM: 2, fmFreeSlots: 1, checkInMay: 15, checkInJune: 0  },
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

// Keyed by email for lookup after email verification
const TESTER_BY_EMAIL: Record<string, TesterData> = {};
for (const d of Object.values(TESTER_DATA)) {
  TESTER_BY_EMAIL[d.email.toLowerCase()] = d;
}

export function getTesterData(phoneNumber: string): TesterData | null {
  const normalized = phoneNumber.replace(/^\+/, "");
  return TESTER_DATA[normalized] ?? null;
}

export function getTesterByEmail(email: string): TesterData | null {
  return TESTER_BY_EMAIL[email.toLowerCase()] ?? null;
}

export function isApprovedEmail(email: string): boolean {
  return APPROVED_EMAILS.has(email.toLowerCase().trim());
}
