import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

export function verifyWebhookSignature(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) {
    res.sendStatus(500);
    return;
  }

  const signature = req.headers["x-hub-signature-256"] as string | undefined;
  if (!signature) {
    res.sendStatus(403);
    return;
  }

  const expected =
    "sha256=" +
    crypto
      .createHmac("sha256", appSecret)
      .update(req.body as Buffer)
      .digest("hex");

  const trusted = Buffer.from(expected, "utf8");
  const received = Buffer.from(signature, "utf8");

  if (
    trusted.length !== received.length ||
    !crypto.timingSafeEqual(trusted, received)
  ) {
    res.sendStatus(403);
    return;
  }

  next();
}
