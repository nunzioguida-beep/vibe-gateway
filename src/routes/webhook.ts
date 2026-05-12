import { Router, Request, Response } from "express";
import { verifyWebhookSignature } from "../middleware/verifyWebhook";
import { forwardToAgent } from "../services/vibeCore";
import { sendTextMessage, markMessageRead, downloadMedia } from "../services/whatsapp";
import {
  getOrCreateConversation,
  getOrCreateConversationDetails,
  setConversationPendingVerification,
  setConversationVerified,
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

        // Identity verification
        const conv = await getOrCreateConversationDetails(envelope.from).catch(() => null);
        if (conv && !conv.verified) {
          const handled = await handleVerification(conv, envelope);
          if (handled) continue;
        }

        // Attach verified user name so the agent knows who it's talking to
        if (conv?.verified && conv.user_name) {
          envelope.userName = conv.user_name;
        }

        // Fetch history to give the bot memory (best-effort)
        try {
          const conversationId = conv?.id ?? await getOrCreateConversation(envelope.from);
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

const AFFIRMATIVE = new Set(["si", "sì", "yes", "sono io", "confermo", "ok", "esatto", "certo", "sure", "sim", "sí"]);

async function handleVerification(
  conv: { id: string; verified: boolean; user_name: string | null },
  envelope: { from: string; text?: string; type: string }
): Promise<boolean> {
  const knownUsers: Record<string, string> = JSON.parse(process.env.KNOWN_USERS ?? "{}");
  const knownName = knownUsers[envelope.from];
  const text = envelope.text?.trim() ?? "";

  if (conv.user_name === null) {
    // First interaction — start verification
    if (knownName) {
      await setConversationPendingVerification(conv.id, knownName);
      await sendTextMessage(envelope.from, `Ciao ${knownName.split(" ")[0]}! 👋 Sei tu a scrivere? Rispondi "sì" per confermare.`);
    } else {
      await setConversationPendingVerification(conv.id, "__pending__");
      await sendTextMessage(envelope.from, `Ciao! 👋 Per tutelare la tua privacy, puoi dirmi il tuo nome e cognome?`);
    }
    return true;
  }

  // Verification in progress
  if (conv.user_name !== "__pending__" && AFFIRMATIVE.has(text.toLowerCase())) {
    // Known user confirmed — use knownName as fallback if user_name was lost
    const verifiedName = conv.user_name ?? knownName ?? text;
    await setConversationVerified(conv.id, verifiedName);
    await sendTextMessage(envelope.from, `Perfetto ${verifiedName.split(" ")[0]}! ✅ Come posso aiutarti?`);
    return true;
  }

  if (conv.user_name === "__pending__" && text.length > 1) {
    // Unknown user provided name
    await setConversationVerified(conv.id, text);
    await sendTextMessage(envelope.from, `Grazie ${text.split(" ")[0]}! ✅ Come posso aiutarti?`);
    return true;
  }

  // Unrecognised response — re-ask
  if (knownName) {
    await sendTextMessage(envelope.from, `Non ho capito. Sei ${knownName.split(" ")[0]}? Rispondi "sì" per confermare.`);
  } else {
    await sendTextMessage(envelope.from, `Puoi dirmi il tuo nome e cognome per procedere?`);
  }
  return true;
}

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
