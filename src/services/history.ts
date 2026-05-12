import { supabase } from "../lib/supabase";
import { MessageEnvelope, HistoryMessage } from "../types/contracts";

export async function getOrCreateConversation(phone: string): Promise<string> {
  const { data, error } = await supabase
    .from("conversations")
    .upsert({ phone }, { onConflict: "phone" })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

export async function saveUserMessage(
  conversationId: string,
  envelope: MessageEnvelope
): Promise<void> {
  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    whatsapp_msg_id: envelope.messageId,
    role: "user",
    message_type: envelope.type,
    content: envelope.text ?? envelope.audioData ?? "",
  });

  if (error) throw error;
}

export async function getRecentMessages(
  conversationId: string,
  limit = 10
): Promise<HistoryMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return (data as HistoryMessage[]).reverse();
}

export async function saveAssistantMessage(
  conversationId: string,
  reply: string,
  messageType: "text" | "audio" = "text"
): Promise<void> {
  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    role: "assistant",
    message_type: messageType,
    content: reply,
  });

  if (error) throw error;
}
