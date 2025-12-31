/**
 * @fileoverview
 * Conversation history extraction utilities for A2A tasks.
 *
 * This module provides utilities for extracting and consolidating conversation
 * history from A2A tasks, including messages from referenced/chained tasks.
 * This enables multi-turn conversations to maintain full context across
 * task boundaries.
 *
 * @example
 * ```typescript
 * // Extract history for context in a new request
 * const task = await context.getTask();
 * const history = getHistory(task);
 *
 * const request = {
 *   messages: [
 *     ...history,
 *     { role: "user", content: "Continue from where we left off" }
 *   ]
 * };
 * ```
 *
 * @module utils/history
 * @license Apache-2.0
 *
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import { API } from "@artinet/types";
import { A2A, getContent } from "@artinet/sdk";

/**
 * Extracts conversation history from an A2A task.
 *
 * Consolidates messages from:
 * 1. Referenced tasks (for context chaining)
 * 2. The current task's history
 *
 * Messages are filtered to remove empty content and JSON-serialized
 * empty objects/arrays that don't contribute meaningful context.
 *
 * @param task - The A2A task to extract history from
 * @param filter - Optional filter function to further refine the history
 * @returns Array of API.Message objects suitable for LLM requests
 *
 * @example
 * ```typescript
 * // Basic usage
 * const history = getHistory(task);
 *
 * // With custom filter (e.g., only user messages)
 * const userMessages = getHistory(task, (msg) => msg.role === "user");
 * ```
 */
export function getHistory(
  task: A2A.Task,
  filter?: (message: API.Message) => boolean
): API.Message[] {
  if (!task) return [];

  // Extract messages from the current task
  let history: API.Message[] =
    task.history?.map((message: A2A.Message) => {
      return {
        role: message.role,
        content: getContent(message) ?? "",
      };
    }) ?? [];

  // Return early if no referenced tasks
  if (!task.metadata?.referencedTasks) return history;

  // Consolidate messages from referenced tasks, then append current history
  history = [
    ...(task.metadata?.referencedTasks as A2A.Task[])
      ?.flatMap((referencedTask: A2A.Task) => {
        const sessionMessages: API.Message[] =
          referencedTask.history?.map((message: A2A.Message) => {
            return {
              role: message.role,
              content: getContent(message) ?? "",
            };
          }) ?? [];
        return sessionMessages;
      })
      // Filter out undefined messages
      .filter((message: API.Message) => message !== undefined)
      // Filter out empty or serialized empty content
      .filter(
        (message: API.Message) =>
          message.content !== "" &&
          message.content !== "{}" &&
          message.content !== "[]"
      ),
    ...history,
  ];

  return filter ? history.filter(filter) : history;
}
