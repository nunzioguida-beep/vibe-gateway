export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export interface UserContext {
  plan?: string;
  favoriteGym?: string | null;
  fmFreeSlots?: number;
  checkInMay?: number;
  checkInJune?: number;
  fmName?: string;
  fmPlan?: string;
  fmGym?: string | null;
  accountNotes?: string;
  suggestedPartner?: string;
}

export interface MessageEnvelope {
  messageId: string;
  from: string;
  timestamp: string;
  type: "text" | "audio";
  text?: string;
  audioData?: string;
  audioMimeType?: string;
  history?: HistoryMessage[];
  userName?: string;
  transcription?: string;
  userContext?: UserContext;
}

export interface AgentResponse {
  reply: string;
  messageId: string;
  transcription?: string;
}
