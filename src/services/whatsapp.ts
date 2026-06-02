import axios from "axios";

const BASE_URL = "https://graph.facebook.com/v19.0";

function getToken(phoneNumberId?: string): string {
  const pid2 = process.env.META_PHONE_NUMBER_ID_2;
  if (pid2 && phoneNumberId === pid2) {
    return process.env.META_API_TOKEN_2 ?? process.env.META_API_TOKEN ?? "";
  }
  return process.env.META_API_TOKEN ?? "";
}

export async function sendTextMessage(
  to: string,
  text: string,
  phoneNumberId?: string
): Promise<void> {
  const resolvedPhoneNumberId = phoneNumberId ?? process.env.META_PHONE_NUMBER_ID;
  const token = getToken(resolvedPhoneNumberId);

  await axios.post(
    `${BASE_URL}/${resolvedPhoneNumberId}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );
}

export async function downloadMedia(mediaId: string, phoneNumberId?: string): Promise<{ data: Buffer; mimeType: string }> {
  const token = getToken(phoneNumberId);
  const { data: mediaInfo } = await axios.get<{ url: string; mime_type: string }>(
    `${BASE_URL}/${mediaId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const response = await axios.get<ArrayBuffer>(mediaInfo.url, {
    headers: { Authorization: `Bearer ${token}` },
    responseType: "arraybuffer",
  });
  return {
    data: Buffer.from(response.data),
    mimeType: mediaInfo.mime_type || "audio/ogg",
  };
}

export async function markMessageRead(
  messageId: string,
  phoneNumberId?: string
): Promise<void> {
  const resolvedPhoneNumberId = phoneNumberId ?? process.env.META_PHONE_NUMBER_ID;
  const token = getToken(resolvedPhoneNumberId);

  await axios.post(
    `${BASE_URL}/${resolvedPhoneNumberId}/messages`,
    {
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );
}
