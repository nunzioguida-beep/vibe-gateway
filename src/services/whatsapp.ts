import axios from "axios";

const BASE_URL = "https://graph.facebook.com/v19.0";

export async function sendTextMessage(
  to: string,
  text: string
): Promise<void> {
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
  const token = process.env.META_API_TOKEN;

  await axios.post(
    `${BASE_URL}/${phoneNumberId}/messages`,
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

export async function markMessageRead(messageId: string): Promise<void> {
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
  const token = process.env.META_API_TOKEN;

  await axios.post(
    `${BASE_URL}/${phoneNumberId}/messages`,
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
