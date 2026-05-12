export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
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
}

export interface AgentResponse {
  reply: string;
  messageId: string;
}
