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
import { getTesterData } from "../services/darwinData";
import { MessageEnvelope, AgentResponse } from "../types/contracts";

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

        // Attach Darwin user context if available
        const testerData = getTesterData(envelope.from);
        if (testerData) {
          envelope.userContext = {
            plan: testerData.plan,
            favoriteGym: testerData.favoriteGym,
            fmFreeSlots: testerData.fmFreeSlots,
            checkInMay: testerData.checkInMay,
            checkInJune: testerData.checkInJune,
          };
        }

        // Fetch history to give the bot memory (best-effort)
        try {
          const conversationId = conv?.id ?? await getOrCreateConversation(envelope.from);
          envelope.history = await getRecentMessages(conversationId);
        } catch (_) {}

        console.log(`[webhook] forwarding to agent: ${envelope.from} "${envelope.text ?? "audio"}" history:${envelope.history?.length ?? 0}`);
        let agentResponse: AgentResponse;
        try {
          agentResponse = await forwardToAgent(envelope);
        } catch (agentErr) {
          console.error("[webhook] agent error, sending fallback:", agentErr);
          await sendTextMessage(envelope.from, "Sorry, I'm having trouble responding right now. Please try again in a moment or visit support.wellhub.com 🙏");
          continue;
        }
        console.log(`[webhook] agent replied: "${agentResponse.reply.slice(0, 80)}"`);
        await sendTextMessage(envelope.from, agentResponse.reply);
        console.log(`[webhook] message sent to ${envelope.from}`);

        // Persist to Supabase in background — sequential so user msg always has earlier created_at than assistant msg
        // For audio: store the transcription text (returned by vibe-core) instead of raw base64
        if (envelope.type === "audio" && agentResponse.transcription) {
          envelope.transcription = agentResponse.transcription;
        }
        getOrCreateConversation(envelope.from)
          .then(async (conversationId) => {
            await saveUserMessage(conversationId, envelope);
            await saveAssistantMessage(conversationId, agentResponse.reply);
          })
          .catch((e) => console.error("Supabase persistence error:", e));
      }
    } catch (err) {
      console.error("Error handling webhook:", err);
    }
  }
);

const AFFIRMATIVE = new Set(["si", "sì", "yes", "sono io", "confermo", "ok", "esatto", "certo", "sure", "sim", "sí"]);

type Lang = "it" | "en" | "pt" | "es";

function detectLang(text: string): Lang {
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/);
  // Portuguese — exclusive chars first
  if (/[ãõ]/.test(lower)) return "pt";
  const ptWords = ["olá", "ola", "obrigado", "obrigada", "valeu", "sim", "tudo", "tchau", "meu", "minha", "posso", "preciso", "pode", "fazer", "boa", "bom", "até"];
  if (ptWords.some(w => words.includes(w))) return "pt";
  // Spanish — exclusive chars first
  if (/[¿¡]/.test(lower) || /[á]/.test(lower)) return "es";
  const esWords = ["hola", "gracias", "puedo", "quiero", "ayuda", "entendido", "listo", "genial", "adiós", "adios", "buenas", "bueno"];
  if (esWords.some(w => words.includes(w))) return "es";
  // Italian
  if (/[àèìòùé]/.test(lower)) return "it";
  const itWords = ["ciao", "sono", "voglio", "cosa", "come", "grazie", "prego", "salve", "buongiorno", "aiuto", "arrivederci"];
  if (itWords.some(w => words.includes(w))) return "it";
  return "en";
}

const GREET: Record<Lang, string> = {
  it: "Ciao! 👋 Sono Vibe, il tuo assistente Wellhub. Sono qui per aiutarti con palestre, piani, prenotazioni e molto altro.\n\nCome ti chiami?",
  en: "Hi! 👋 I'm Vibe, your Wellhub assistant. I'm here to help you with gyms, plans, bookings and more.\n\nCould you tell me your name?",
  pt: "Olá! 👋 Sou o Vibe, seu assistente Wellhub. Estou aqui para ajudar com academias, planos, reservas e muito mais.\n\nQual é o seu nome?",
  es: "¡Hola! 👋 Soy Vibe, tu asistente de Wellhub. Estoy aquí para ayudarte con gimnasios, planes, reservas y más.\n\n¿Cuál es tu nombre?",
};

function buildWelcomeBack(firstName: string, lang: Lang, phone: string): string {
  const d = getTesterData(phone);

  if (d) {
    const gymPart: Record<Lang, string> = {
      it: d.favoriteGym ? ` e per apprezzare così tanto ${d.favoriteGym}!` : "!",
      en: d.favoriteGym ? ` and for loving ${d.favoriteGym} so much!` : "!",
      pt: d.favoriteGym ? ` e por amar tanto o ${d.favoriteGym}!` : "!",
      es: d.favoriteGym ? ` y por amar tanto ${d.favoriteGym}!` : "!",
    };
    const msgs: Record<Lang, string> = {
      it: `Bene ${firstName}! 🎉 Che piacere averti qui — grazie per essere il nostro utente ${d.plan}${gymPart.it} Come posso aiutarti oggi?`,
      en: `Great ${firstName}! 🎉 So happy to have you here — thank you for being our ${d.plan} member${gymPart.en} How can I help you today?`,
      pt: `Ótimo ${firstName}! 🎉 Que prazer ter você aqui — obrigado por ser nosso usuário ${d.plan}${gymPart.pt} Como posso te ajudar hoje?`,
      es: `¡Genial ${firstName}! 🎉 Qué placer tenerte aquí — gracias por ser nuestro usuario ${d.plan}${gymPart.es} ¿En qué puedo ayudarte hoy?`,
    };
    return msgs[lang];
  }

  const generic: Record<Lang, string> = {
    it: `Piacere ${firstName}! 🎉 Come posso aiutarti oggi?`,
    en: `Nice to meet you, ${firstName}! 🎉 How can I help you today?`,
    pt: `Prazer, ${firstName}! 🎉 Como posso te ajudar hoje?`,
    es: `¡Encantado, ${firstName}! 🎉 ¿En qué puedo ayudarte hoy?`,
  };
  return generic[lang];
}

async function handleVerification(
  conv: { id: string; verified: boolean; user_name: string | null },
  envelope: { from: string; text?: string; type: string }
): Promise<boolean> {
  const text = envelope.text?.trim() ?? "";
  const lang = detectLang(text);
  const greet = GREET[lang];

  if (conv.user_name === null || conv.user_name !== "__pending__") {
    await setConversationPendingVerification(conv.id, "__pending__");
    await sendTextMessage(envelope.from, greet);
    return true;
  }

  if (conv.user_name === "__pending__" && text.length > 1) {
    await setConversationVerified(conv.id, text);
    const firstName = text.split(" ")[0];
    await sendTextMessage(envelope.from, buildWelcomeBack(firstName, lang, envelope.from));
    return true;
  }

  // Too short — re-ask
  await sendTextMessage(envelope.from, greet);
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
