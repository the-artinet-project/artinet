/**
 * @fileoverview openclaw → artinet utils
 *
 * @module @artinet/cruiser/openclaw/utils
 * @internal
 */

import * as sdk from "@artinet/sdk";

export type OpenClawTool = {
  name: string;
  description?: string;
};

export type OpenClawDeviceIdentity = {
  id: string;
  publicKey: string;
  privateKeyPem?: string;
  signature?: string;
  signedAt?: number;
  nonce?: string;
};

export type OpenClawAgent = {
  /**
   * A2A card display name.
   */
  name: string;
  /**
   * Gateway base URL, e.g. http://127.0.0.1:18789
   */
  gatewayUrl?: string;
  /**
   * OpenClaw agent id. Defaults to "main".
   */
  agentId?: string;
  /**
   * Gateway auth token (token mode).
   */
  authToken?: string;
  /**
   * Gateway auth password (password mode).
   */
  authPassword?: string;
  /**
   * Optional fixed session key routed by OpenClaw gateway.
   */
  sessionKey?: string;
  /**
   * Optional explicit device identity for strict pairing setups.
   */
  device?: OpenClawDeviceIdentity;
  /**
   * Optional path where cruiser stores generated OpenClaw device auth state.
   * Defaults to ~/artinet-openclaw.auth when auto device auth is enabled.
   */
  authFilePath?: string;
  /**
   * Enables automatic device identity bootstrap + persisted device token usage.
   * Defaults to true.
   */
  autoDeviceAuth?: boolean;
  /**
   * Optional custom scopes passed during gateway connect.
   */
  scopes?: string[];
  description?: string;
  tools?: OpenClawTool[];
};

function createSkills(tools: OpenClawTool[] | undefined): sdk.A2A.AgentSkill[] {
  return (
    tools?.map((tool: OpenClawTool) => ({
      id: tool.name,
      name: tool.name,
      description: tool.description ?? `Tool: ${tool.name}`,
      tags: ["tool"],
    })) ?? []
  );
}

function createDescription(agent: OpenClawAgent): string {
  if (agent.description && agent.description.trim().length > 0) {
    return agent.description.trim();
  }

  return "An OpenClaw Gateway agent connected through @artinet/cruiser";
}

export async function getAgentCard({
  agent,
  card,
}: {
  agent: OpenClawAgent;
  card?: sdk.A2A.AgentCardParams;
}): Promise<sdk.A2A.AgentCard> {
  return sdk.describe.card({
    name: agent.name,
    ...(typeof card === "string" ? { name: card } : card),
    description: createDescription(agent),
    capabilities: {
      streaming: true,
      pushNotifications: true,
      stateTransitionHistory: false,
    },
    defaultInputModes: ["text"],
    defaultOutputModes: ["text"],
    skills: createSkills(agent.tools),
  });
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

export function extractOpenClawText(result: OpenClawResult): string {
  const record = asRecord(result);
  if (!record) {
    return "";
  }

  const payloads = record.payloads;
  if (Array.isArray(payloads)) {
    const text = payloads
      .map((payload: unknown) => {
        const entry = asRecord(payload);
        if (typeof entry?.text === "string") {
          return entry.text;
        }
        return "";
      })
      .filter((item: string) => item.length > 0)
      .join("\n")
      .trim();

    if (text.length > 0) {
      return text;
    }
  }

  const choices = record.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return "";
  }

  const firstChoice = asRecord(choices[0]);
  const message = asRecord(firstChoice?.message);
  const content = message?.content;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part: unknown) => {
        if (typeof part === "string") {
          return part;
        }

        const partRecord = asRecord(part);
        if (typeof partRecord?.text === "string") {
          return partRecord.text;
        }

        return JSON.stringify(part);
      })
      .join("\n");
  }

  return "";
}

export type OpenClawResult = Record<string, unknown>;
