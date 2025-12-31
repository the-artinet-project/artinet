import express from "express";
import * as sdk from "@artinet/sdk";
import { ResultOrError } from "../../types.js";

export function toJSONRPCResponse(
  id: string,
  result_or_error: ResultOrError
):
  | { jsonrpc: "2.0"; id: string; result: unknown }
  | { jsonrpc: "2.0"; id: string; error: unknown } {
  if (result_or_error.type === "success") {
    return { jsonrpc: "2.0", id, result: result_or_error.result };
  }
  if (result_or_error.type === "error") {
    return { jsonrpc: "2.0", id, error: result_or_error.error };
  }
  throw new Error("Invalid response type");
}

export async function handleJSONRPCResponse(
  res: express.Response,
  id: string,
  method: string,
  response: ResultOrError
): Promise<void> {
  if (response.type === "success" && method === "agentcard/get") {
    res.json(response.result);
    return;
  }

  if (response.type === "success") {
    res.json(toJSONRPCResponse(String(id), response));
    return;
  }

  if (response.type === "error") {
    res.status(500).json(toJSONRPCResponse(String(id), response));
    return;
  }

  if (response.type === "stream") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    const stream = response.stream;
    for await (const data of stream) {
      res.write(
        `data: ${JSON.stringify({ jsonrpc: "2.0", id, result: data })}\n\n`
      );
    }
    res.end();
    return;
  }

  throw sdk.INTERNAL_ERROR({ message: "Unknown response type" });
}
