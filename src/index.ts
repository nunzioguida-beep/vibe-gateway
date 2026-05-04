import "dotenv/config";
import express from "express";
import webhookRouter from "./routes/webhook";

const app = express();
const PORT = process.env.PORT ?? 3000;

// Raw body required for signature verification — must be before json()
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as express.Request & { body: Buffer }).body = buf;
    },
  })
);

app.use("/", webhookRouter);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.listen(PORT, () => {
  console.log(`vibe-gateway listening on port ${PORT}`);
});
