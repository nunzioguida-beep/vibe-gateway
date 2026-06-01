export interface TesterData {
  name: string;
  plan: string;
  favoriteGym: string | null;
  activeFM: number;
  fmFreeSlots: number;
  checkInMay: number;
  checkInJune: number;
}

// Keyed by phone number WITHOUT leading +
// Data from Darwin simulation Google Sheet (June 2026)
// TODO: fill in phone numbers for each tester
const TESTER_DATA: Record<string, TesterData> = {
  "393357295306": { name: "Nunzio",   plan: "Gold",      favoriteGym: "Energie Fitness",              activeFM: 1, fmFreeSlots: 2, checkInMay: 20, checkInJune: 1  },
  // "55XXXXXXXXXX":  { name: "Cesar",   plan: "Diamond",   favoriteGym: "F45",                          activeFM: 1, fmFreeSlots: 2, checkInMay: 6,  checkInJune: 0  },
  // "55XXXXXXXXXX":  { name: "Thiago",  plan: "Gold",      favoriteGym: null,                           activeFM: 1, fmFreeSlots: 2, checkInMay: 0,  checkInJune: 0  },
  // "55XXXXXXXXXX":  { name: "Gustavo", plan: "Gold",      favoriteGym: "Montville Pickleball & Golf", activeFM: 2, fmFreeSlots: 1, checkInMay: 15, checkInJune: 0  },
  // "55XXXXXXXXXX":  { name: "Bruno",   plan: "Gold",      favoriteGym: null,                           activeFM: 1, fmFreeSlots: 2, checkInMay: 0,  checkInJune: 0  },
  // "1XXXXXXXXXX":   { name: "Ellen",   plan: "Gold",      favoriteGym: "Solidcore W 57",               activeFM: 0, fmFreeSlots: 3, checkInMay: 17, checkInJune: 0  },
  // "1XXXXXXXXXX":   { name: "Carolee", plan: "Platinum",  favoriteGym: "Monterey Core Fitness",        activeFM: 0, fmFreeSlots: 3, checkInMay: 4,  checkInJune: 0  },
  // "55XXXXXXXXXX":  { name: "Eduardo", plan: "Gold+",     favoriteGym: null,                           activeFM: 0, fmFreeSlots: 3, checkInMay: 0,  checkInJune: 0  },
  // "55XXXXXXXXXX":  { name: "Daniel",  plan: "Diamond+",  favoriteGym: "Bodytech",                     activeFM: 0, fmFreeSlots: 3, checkInMay: 4,  checkInJune: 0  },
  // "55XXXXXXXXXX":  { name: "Victor",  plan: "Platinum",  favoriteGym: null,                           activeFM: 2, fmFreeSlots: 1, checkInMay: 6,  checkInJune: 0  },
  // "XXXXXXXXXXX":   { name: "Livia",   plan: "Diamond+",  favoriteGym: "Reebok Sport Club",            activeFM: 2, fmFreeSlots: 1, checkInMay: 6,  checkInJune: 0  },
};

export function getTesterData(phoneNumber: string): TesterData | null {
  const normalized = phoneNumber.replace(/^\+/, "");
  return TESTER_DATA[normalized] ?? null;
}
