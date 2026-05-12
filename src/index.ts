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

app.get("/health", (_req, res) => res.json({ status: "ok", version: "verified-v2" }));

app.listen(PORT, () => {
  console.log(`vibe-gateway listening on port ${PORT}`);
});
