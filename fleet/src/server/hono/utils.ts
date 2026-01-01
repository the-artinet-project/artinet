/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */

import { v4 as uuidv4 } from "uuid";
import slugify from "@sindresorhus/slugify";

export function generateRequestId(
  context: { requestId?: string },
  reqId?: string
): string {
  return context.requestId ?? reqId ?? uuidv4();
}

export const generateRegistrationId = (uri: string) => {
  return slugify(uri.replace(/^(agent|registration):/i, ""));
};
