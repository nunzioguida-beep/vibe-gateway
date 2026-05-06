import axios from "axios";
import { MessageEnvelope, AgentResponse } from "../types/contracts";

export async function forwardToAgent(
  envelope: MessageEnvelope
): Promise<AgentResponse> {
  const url = process.env.VIBE_CORE_URL;

  const { data } = await axios.post<AgentResponse>(
    `${url}/process`,
    envelope,
    { headers: { "Content-Type": "application/json" }, timeout: 15000 }
  );

  return data;
}
