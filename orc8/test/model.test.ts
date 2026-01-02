/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import { jest, describe, it, expect, afterEach } from "@jest/globals";
import { API } from "@artinet/types";
import { Model } from "../src/model.js";
import { Monitor } from "../src/monitor.js";
import { echoAgentEngine, testAgentCard } from "./agents/echo-agent.js";
import {
  createMockAgentRequest,
  createMockProvider,
  MOCK_CONNECT_RESPONSE,
} from "./utils.js";
// import * as util from "../src/model-util.js";
import * as sdk from "@artinet/sdk";
jest.setTimeout(60000);
// sdk.applyDefaults();
describe("Model Tests", () => {
  let model: Model;

  afterEach(async () => {
    if (model) {
      await model.stop();
    }
  });

  describe("Model.create", () => {
    it("should create a model with default settings", async () => {
      const mockProvider = createMockProvider("Hello from model");

      const model = Model.create({
        modelId: "test-model",
        provider: mockProvider,
      });

      expect(model).toBeDefined();
      expect(model.count).toBe(0);
    });

    it("should create a model with custom provider", async () => {
      const customResponse = "Custom response from provider";
      const mockProvider = createMockProvider(customResponse);

      const model = Model.create({
        modelId: "custom-model",
        provider: mockProvider,
      });

      expect(model).toBeDefined();
      expect(model.provider).toBe(mockProvider);
    });

    it("should create a model with abort signal", async () => {
      const abortController = new AbortController();
      const mockProvider = createMockProvider("Test response");

      const model = Model.create({
        modelId: "abort-model",
        provider: mockProvider,
        abortSignal: abortController.signal,
      });

      expect(model).toBeDefined();
      expect(model.abortSignal).toBe(abortController.signal);
    });

    it("should create a model with custom events monitor", async () => {
      const customMonitor = new Monitor();
      const mockProvider = createMockProvider("Test response");

      const model = Model.create({
        modelId: "events-model",
        provider: mockProvider,
        events: customMonitor,
      });

      expect(model).toBeDefined();
      expect(model.events).toBe(customMonitor);
    });
  });

  describe("Model.add", () => {
    it("should add an agent service", async () => {
      const mockProvider = createMockProvider("Test response");

      const model = Model.create({
        modelId: "test-model",
        provider: mockProvider,
      });

      model.add({
        engine: echoAgentEngine,
        agentCard: testAgentCard,
      });

      // Wait for the async add to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(model.count).toBe(1);
      await model.stop();
    });
    it("should call an agent service", async () => {
      const mockProvider = createMockProvider(
        "Test response",
        [],
        [createMockAgentRequest("test-agent", "Hello Test Agent!")]
      );

      const abortController = new AbortController();
      const model = Model.create({
        modelId: "test-model",
        provider: mockProvider,
        abortSignal: abortController.signal,
      });

      let called = false;

      model.add(
        {
          engine: async function* (context: sdk.A2A.Context) {
            const userText = sdk.getContent(context.userMessage) ?? "";
            called = true;
            expect(userText).toBe("Hello Test Agent!");
            if (!userText) {
              yield sdk.FAILED_UPDATE(
                context.taskId,
                context.contextId,
                context.userMessage.messageId,
                "no user message detected"
              );
              return;
            }
            yield sdk.STATUS_UPDATE(
              context.taskId,
              context.contextId,
              sdk.A2A.TaskState.completed,
              sdk.describe.message({
                role: "agent",
                parts: [{ kind: "text", text: `Test response: ${userText}` }],
              })
            );
            abortController.abort();
            return;
          },
          agentCard: testAgentCard,
        },
        "test-agent"
      );

      // Wait for the async add to complete
      await new Promise((resolve) => setTimeout(resolve, 50));
      await model.connect("Hello!");
      expect(called).toBe(true);
      await model.stop();
    });

    it("should chain multiple add calls", async () => {
      const mockProvider = createMockProvider("Test response");

      const model = Model.create({
        modelId: "test-model",
        provider: mockProvider,
      });

      model
        .add({
          engine: echoAgentEngine,
          agentCard: testAgentCard,
        })
        .add({
          engine: echoAgentEngine,
          agentCard: { ...testAgentCard, name: "test-agent-2" },
        });

      // Wait for the async adds to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(model.count).toBe(2);
      await model.stop();
    });
  });

  describe("Model.connect", () => {
    it("should connect with a string message", async () => {
      const mockProvider = createMockProvider("Hello, World!");

      model = Model.create({
        modelId: "test-model",
        provider: mockProvider,
      });

      const response = await model.connect("Hello!");
      expect(response).toBe("Hello, World!");
      await model.stop();
    });

    it("should connect with a message object", async () => {
      const mockProvider = createMockProvider("Response to message");

      const model = Model.create({
        modelId: "test-model",
        provider: mockProvider,
      });

      const message: API.Message = {
        role: "user",
        content: "Test message",
      };

      const response = await model.connect(message);
      expect(response).toBe("Response to message");
      await model.stop();
    });

    it("should connect with a session array", async () => {
      const mockProvider = createMockProvider("Session response");

      const model = Model.create({
        modelId: "test-model",
        provider: mockProvider,
      });

      const session: API.Session = [
        { role: "user", content: "Message 1" },
        { role: "agent", content: "Response 1" },
        { role: "user", content: "Message 2" },
      ];

      const response = await model.connect(session);
      expect(response).toBe("Session response");
      await model.stop();
    });
  });

  describe("Model.events", () => {
    it("should have events monitor", async () => {
      const mockProvider = createMockProvider("Test response");

      const model = Model.create({
        modelId: "test-model",
        provider: mockProvider,
      });

      expect(model.events).toBeDefined();
      expect(model.events).toBeInstanceOf(Monitor);
      await model.stop();
    });
  });

  describe("Model.agent", () => {
    it("should expose model as an A2A agent", async () => {
      const mockProvider = createMockProvider("Agent response");

      const model = Model.create({
        modelId: "test-model",
        provider: mockProvider,
      });

      const agent = model.agent;
      expect(agent).toBeDefined();
      expect(agent.agentCard.name).toBe("test-model-agent");
      await model.stop();
    });
    it("should call the model as an A2A agent", async () => {
      const mockProvider = createMockProvider("Agent response");

      const model = Model.create({
        modelId: "test-model",
        provider: mockProvider,
      });

      const response = await model.agent.sendMessage("Hello!");
      expect((response as sdk.A2A.Task).status.message?.parts[0]).toEqual({
        kind: "text",
        text: "Agent response",
      });
      await model.stop();
    });
    it("Should wait for add to complete before executing", async () => {
      const mockProvider = jest.fn(async () =>
        MOCK_CONNECT_RESPONSE("Agent response")
      );

      const model = Model.create({
        modelId: "test-model",
        provider: mockProvider,
      });

      model.add(
        {
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-everything@2025.11.25"],
        },
        "everything-server"
      );

      const response = (await model.agent.sendMessage(
        "Hello!"
      )) as sdk.A2A.Task;

      // const services = Array.from(model.values);
      // expect(services.length).toBeGreaterThan(0);
      expect(mockProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            tools: expect.objectContaining({
              services: expect.arrayContaining([
                expect.objectContaining({
                  uri: "everything-server",
                }),
              ]),
            }),
          }),
        }),
        expect.anything()
      );
      const responseMessage = response.status.message?.parts[0];
      expect((responseMessage as sdk.A2A.TextPart).text).toBe("Agent response");
      await model.stop();
    });
  });
});
