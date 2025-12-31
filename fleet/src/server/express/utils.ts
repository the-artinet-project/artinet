import express from "express";
import { v4 as uuidv4 } from "uuid";
import slugify from "@sindresorhus/slugify";

export function generateRequestId(
  context: { requestId?: string },
  req: express.Request
): string {
  return (
    context.requestId ??
    (req?.headers?.["x-request-id"] as string | undefined) ??
    (req?.body?.id as string | undefined) ??
    uuidv4()
  );
}

export const generateRegistrationId = (uri: string) => {
  return slugify(uri.replace(/^(agent|registration):/i, ""));
};
