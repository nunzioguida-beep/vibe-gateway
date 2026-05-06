import "dotenv/config";
import express from "express";
import webhookRouter from "./routes/webhook";

const app = express();
const PORT = process.env.PORT ?? 3000;

// Raw body stored on req.rawBody for signature verification
app.use(
  express.json({
    verify: (req: express.Request & { rawBody?: Buffer }, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.use("/", webhookRouter);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.get("/test-flow", async (_req, res) => {
  const steps: Record<string, unknown> = {};
  try {
    const { getOrCreateConversation } = await import("./services/history");
    const convId = await getOrCreateConversation("test_debug");
    steps.supabase = convId;
  } catch (e) { steps.supabase_error = String(e); }

  try {
    const { forwardToAgent } = await import("./services/vibeCore");
    const reply = await forwardToAgent({ messageId: "test", from: "test", timestamp: "0", type: "text", text: "ciao" });
    steps.vibecore = reply;
  } catch (e) { steps.vibecore_error = String(e); }

  try {
    const { sendTextMessage } = await import("./services/whatsapp");
    await sendTextMessage("393357295306", "Test automatico dal gateway!");
    steps.whatsapp = "sent";
  } catch (e) { steps.whatsapp_error = String(e); }

  res.json(steps);
});

app.listen(PORT, () => {
  console.log(`vibe-gateway listening on port ${PORT}`);
});
