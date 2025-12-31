/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview A2A Executor
 *
 * This module provides a function for converting an A2A executor into an AgentEngine.
 */

import { AgentEngine, Context, UpdateEvent, Task } from "@artinet/sdk";
import {
  AgentExecutor,
  RequestContext,
  ExecutionEventBus,
  ExecutionEventQueue,
  DefaultExecutionEventBus,
} from "@a2a-js/sdk/server";
/**
 * Converts an A2A executor into an AgentEngine.
 *
 * @param executor - The A2A executor to convert.
 * @returns The AgentEngine.
 */
export function convertExecutor(executor: AgentExecutor): AgentEngine {
  const engine: AgentEngine = async function* (
    context: Context
  ): AsyncGenerator<UpdateEvent, void, undefined> {
    const eventBus: ExecutionEventBus = new DefaultExecutionEventBus();
    const eventQueue: ExecutionEventQueue = new ExecutionEventQueue(eventBus);

    const task: Task = context.State().task;

    const requestContext: RequestContext = new RequestContext(
      context.command.message,
      task.id,
      task.contextId,
      task,
      task.metadata?.referenceTasks as Task[] | undefined
    );

    context.events.on("cancel", (_) => {
      executor.cancelTask(task.id, eventBus);
    });

    const executionPromise = executor.execute(requestContext, eventBus);

    yield* eventQueue.events();

    await executionPromise;
  };
  return engine;
}
