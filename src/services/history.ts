import { supabase } from "../lib/supabase";
import { MessageEnvelope, HistoryMessage } from "../types/contracts";

export interface ConversationDetails {
  id: string;
  verified: boolean;
  user_name: string | null;
}

export async function getOrCreateConversation(phone: string): Promise<string> {
  const details = await getOrCreateConversationDetails(phone);
  return details.id;
}

export async function getOrCreateConversationDetails(phone: string): Promise<ConversationDetails> {
  const { data: existing } = await supabase
    .from("conversations")
    .select("id, verified, user_name")
    .eq("phone", phone)
    .single();

  if (existing) {
    return { id: existing.id, verified: !!existing.verified, user_name: existing.user_name ?? null };
  }

  const { data, error } = await supabase
    .from("conversations")
    .insert({ phone })
    .select("id, verified, user_name")
    .single();

  if (error) throw error;
  return { id: data.id, verified: !!data.verified, user_name: data.user_name ?? null };
}

export async function setConversationPendingVerification(id: string, userName: string): Promise<void> {
  await supabase.from("conversations").update({ user_name: userName }).eq("id", id);
}

export async function setConversationVerified(id: string, userName: string): Promise<void> {
  await supabase.from("conversations").update({ verified: true, user_name: userName }).eq("id", id);
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
