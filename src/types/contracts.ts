export interface MessageEnvelope {
  messageId: string;
  from: string;
  timestamp: string;
  type: "text" | "audio";
  text?: string;
  audioUrl?: string;
}

export interface AgentResponse {
  reply: string;
  messageId: string;
}
