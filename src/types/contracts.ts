export interface MessageEnvelope {
  messageId: string;
  from: string;
  timestamp: string;
  type: "text" | "audio";
  text?: string;
  audioData?: string;     // base64 encoded audio
  audioMimeType?: string; // e.g. "audio/ogg; codecs=opus"
}

export interface AgentResponse {
  reply: string;
  messageId: string;
}
