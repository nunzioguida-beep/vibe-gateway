import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

function matchesSecret(secret: string, rawBody: Buffer, signature: string): boolean {
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const trusted = Buffer.from(expected, "utf8");
  const received = Buffer.from(signature, "utf8");
  return trusted.length === received.length && crypto.timingSafeEqual(trusted, received);
}

export function verifyWebhookSignature(
  req: Request & { rawBody?: Buffer },
  res: Response,
  next: NextFunction
): void {
  const signature = req.headers["x-hub-signature-256"] as string | undefined;
  if (!signature) {
    res.sendStatus(403);
    return;
  }

  const body = req.rawBody ?? Buffer.alloc(0);
  const secrets = [
    process.env.META_APP_SECRET,
    process.env.META_APP_SECRET_2,
  ].filter(Boolean) as string[];

  if (secrets.length === 0) {
    res.sendStatus(500);
    return;
  }

  const valid = secrets.some((s) => matchesSecret(s, body, signature));
  if (!valid) {
    res.sendStatus(403);
    return;
  }

  next();
}
