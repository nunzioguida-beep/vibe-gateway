import { Router, Request, Response } from "express";
import { verifyWebhookSignature } from "../middleware/verifyWebhook";
import { forwardToAgent } from "../services/vibeCore";
import { sendTextMessage, markMessageRead, downloadMedia } from "../services/whatsapp";
import {
  getOrCreateConversation,
  saveUserMessage,
  saveAssistantMessage,
  getRecentMessages,
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

      console.log("[webhook] POST received, entry:", JSON.stringify(entry?.changes?.[0]?.value ?? {}).slice(0, 300));

      const messages = value?.messages;
      if (!value || !messages?.length) return;

      for (const msg of messages) {
        const envelope = await buildEnvelope(msg, value);
        if (!envelope) continue;

        // Mark as read so the user sees the double blue tick
        await markMessageRead(msg.id).catch(() => {});

        // Fetch history to give the bot memory (best-effort, don't block on failure)
        try {
          const conversationId = await getOrCreateConversation(envelope.from);
          envelope.history = await getRecentMessages(conversationId);
        } catch (_) {}

        console.log(`[webhook] forwarding to agent: ${envelope.from} "${envelope.text ?? "audio"}" history:${envelope.history?.length ?? 0}`);
        const agentResponse = await forwardToAgent(envelope);
        console.log(`[webhook] agent replied: "${agentResponse.reply.slice(0, 80)}"`);
        await sendTextMessage(envelope.from, agentResponse.reply);
        console.log(`[webhook] message sent to ${envelope.from}`);

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

async function buildEnvelope(
  msg: MetaMessage,
  value: MetaValue
): Promise<MessageEnvelope | null> {
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
    const { data, mimeType } = await downloadMedia(msg.audio.id);
    return {
      messageId: msg.id,
      from: msg.from,
      timestamp: msg.timestamp,
      type: "audio",
      audioData: data.toString("base64"),
      audioMimeType: mimeType,
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
