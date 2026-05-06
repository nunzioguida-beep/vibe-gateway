import { Router, Request, Response } from "express";
import { verifyWebhookSignature } from "../middleware/verifyWebhook";
import { forwardToAgent } from "../services/vibeCore";
import { sendTextMessage, markMessageRead } from "../services/whatsapp";
import {
  getOrCreateConversation,
  saveUserMessage,
  saveAssistantMessage,
} from "../services/history";
import { MessageEnvelope } from "../types/contracts";

const router = Router();

// Meta webhook verification handshake
router.get("/webhook", (req: Request, res: Response) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    console.log("Webhook verified by Meta");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Incoming messages from Meta
router.post(
  "/webhook",
  verifyWebhookSignature,
  async (req: Request, res: Response) => {
    // Acknowledge immediately — Meta expects 200 within 5s
    res.sendStatus(200);

    try {
      const body = req.body as MetaWebhookPayload;
      const entry = body.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;

      const messages = value?.messages;
      if (!value || !messages?.length) return;

      for (const msg of messages) {
        const envelope = buildEnvelope(msg, value);
        if (!envelope) continue;

        // Mark as read so the user sees the double blue tick
        await markMessageRead(msg.id).catch(() => {});

        const agentResponse = await forwardToAgent(envelope);
        await sendTextMessage(envelope.from, agentResponse.reply);

        // Persist to Supabase in background — don't block the reply
        getOrCreateConversation(envelope.from)
          .then((conversationId) =>
            Promise.all([
              saveUserMessage(conversationId, envelope),
              saveAssistantMessage(conversationId, agentResponse.reply),
            ])
          )
          .catch((e) => console.error("Supabase persistence error:", e));
      }
    } catch (err) {
      console.error("Error handling webhook:", err);
    }
  }
);

function buildEnvelope(
  msg: MetaMessage,
  value: MetaValue
): MessageEnvelope | null {
  if (msg.type === "text" && msg.text?.body) {
    return {
      messageId: msg.id,
      from: msg.from,
      timestamp: msg.timestamp,
      type: "text",
      text: msg.text.body,
    };
  }

  if (msg.type === "audio" && msg.audio?.id) {
    // vibe-core resolves the audio URL from the media ID
    return {
      messageId: msg.id,
      from: msg.from,
      timestamp: msg.timestamp,
      type: "audio",
      audioUrl: msg.audio.id,
    };
  }

  return null;
}

// ---- Meta payload shapes ----

interface MetaWebhookPayload {
  entry?: MetaEntry[];
}

interface MetaEntry {
  changes?: MetaChange[];
}

interface MetaChange {
  value?: MetaValue;
}

interface MetaValue {
  messages?: MetaMessage[];
}

interface MetaMessage {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  audio?: { id: string };
}

export default router;
