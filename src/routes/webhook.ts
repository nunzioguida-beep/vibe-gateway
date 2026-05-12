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

function detectLang(text: string): "it" | "en" {
  const lower = text.toLowerCase();
  if (/[àèìòùé]/.test(lower)) return "it";
  const itWords = ["ciao", "sono", "voglio", "cosa", "come", "grazie", "prego", "salve", "buongiorno", "aiuto"];
  if (itWords.some(w => lower.split(/\s+/).includes(w))) return "it";
  return "en";
}

async function handleVerification(
  conv: { id: string; verified: boolean; user_name: string | null },
  envelope: { from: string; text?: string; type: string }
): Promise<boolean> {
  const knownUsers: Record<string, string> = JSON.parse(process.env.KNOWN_USERS ?? "{}");
  const knownName = knownUsers[envelope.from];
  const text = envelope.text?.trim() ?? "";
  const lang = detectLang(text);

  const msg = {
    greetKnown: (name: string) => lang === "en"
      ? `Hi ${name}! 👋 I'm Vibe, your Wellhub assistant. Just to confirm — is that you? Reply "yes" 😊`
      : `Ciao ${name}! 👋 Sono Vibe, il tuo assistente Wellhub. Prima di iniziare, posso chiederti di confermare che sei tu? Rispondi "sì" 😊`,
    greetUnknown: () => lang === "en"
      ? `Hi! 👋 I'm Vibe, the Wellhub assistant. To protect your privacy, could you tell me your full name?`
      : `Ciao! 👋 Sono Vibe, l'assistente Wellhub. Per proteggere la tua privacy, puoi dirmi il tuo nome e cognome?`,
    confirmed: (name: string) => lang === "en"
      ? `Great, ${name}! 🎉 I'm here to help with anything Wellhub-related. What can I do for you?`
      : `Perfetto ${name}! 🎉 Sono qui per aiutarti con tutto ciò che riguarda Wellhub. Come posso esserti utile?`,
    welcome: (name: string) => lang === "en"
      ? `Nice to meet you, ${name}! 🎉 I'm Vibe, your Wellhub assistant. How can I help?`
      : `Piacere ${name}! 🎉 Sono Vibe, il tuo assistente Wellhub. Come posso aiutarti?`,
    reaskKnown: (name: string) => lang === "en"
      ? `Sorry, I didn't catch that 😊 Are you ${name}? Reply "yes" to confirm.`
      : `Scusa, non ho capito bene 😊 Stai scrivendo a ${name}? Rispondi "sì" per confermare.`,
    reaskUnknown: () => lang === "en"
      ? `Could you share your full name so I can assist you better?`
      : `Puoi dirmi il tuo nome e cognome così posso aiutarti meglio?`,
  };

  if (conv.user_name === null) {
    if (knownName) {
      await setConversationPendingVerification(conv.id, knownName);
      await sendTextMessage(envelope.from, msg.greetKnown(knownName.split(" ")[0]));
    } else {
      await setConversationPendingVerification(conv.id, "__pending__");
      await sendTextMessage(envelope.from, msg.greetUnknown());
    }
    return true;
  }

  // Verification in progress
  if (conv.user_name !== "__pending__" && AFFIRMATIVE.has(text.toLowerCase())) {
    const verifiedName = conv.user_name ?? knownName ?? text;
    await setConversationVerified(conv.id, verifiedName);
    await sendTextMessage(envelope.from, msg.confirmed(verifiedName.split(" ")[0]));
    return true;
  }

  if (conv.user_name === "__pending__" && text.length > 1) {
    await setConversationVerified(conv.id, text);
    await sendTextMessage(envelope.from, msg.welcome(text.split(" ")[0]));
    return true;
  }

  // Unrecognised response — re-ask
  if (knownName) {
    await sendTextMessage(envelope.from, msg.reaskKnown(knownName.split(" ")[0]));
  } else {
    await sendTextMessage(envelope.from, msg.reaskUnknown());
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
