/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from "@jest/globals";
import { A2A } from "@artinet/sdk";
import { Monitor } from "../src/monitor.js";

jest.setTimeout(10000);

describe("Monitor Tests", () => {
  let monitor: Monitor;

  beforeEach(() => {
    monitor = new Monitor();
  });

  afterEach(() => {
    monitor.removeAllListeners();
  });

  describe("Monitor creation", () => {
    it("should create a monitor instance", () => {
      expect(monitor).toBeDefined();
      expect(monitor).toBeInstanceOf(Monitor);
    });

    it("should create a monitor with existing contexts map", () => {
      const existingContexts = new Map<string, A2A.Context>();
      const monitorWithContexts = new Monitor(existingContexts);
      expect(monitorWithContexts).toBeDefined();
    });
  });

  describe("Monitor context management", () => {
    it("should check if context exists", async () => {
      const exists = await monitor.has("non-existent");
      expect(exists).toBe(false);
    });

    it("should list contexts", async () => {
      const contexts = await monitor.list();
      expect(contexts).toEqual([]);
    });

    it("should get undefined for non-existent context", async () => {
      const context = await monitor.get("non-existent");
      expect(context).toBeUndefined();
    });
  });

  describe("Monitor event handling", () => {
    it("should emit update events", (done) => {
      monitor.on("update", (state, update) => {
        expect(state).toBe("test-state");
        expect(update).toBeUndefined();
        done();
      });

      monitor.emit("update", "test-state", undefined);
    });

    it("should emit error events", (done) => {
      const testError = new Error("Test error");
      const testTask: A2A.Task = {
        kind: "task",
        id: "test-task-id",
        contextId: "test-context-id",
        status: {
          state: "failed",
        },
      };

      monitor.on("error", (error, task) => {
        expect(error).toBe(testError);
        expect(task).toBe(testTask);
        done();
      });

      monitor.emit("error", testError, testTask);
    });

    it("should handle multiple update listeners", () => {
      let count = 0;

      monitor.on("update", () => {
        count++;
      });

      monitor.on("update", () => {
        count++;
      });

      monitor.emit("update", "test", undefined);

      expect(count).toBe(2);
    });

    it("should remove listeners", () => {
      let called = false;
      const listener = () => {
        called = true;
      };

      monitor.on("update", listener);
      monitor.removeListener("update", listener);

      monitor.emit("update", "test", undefined);

      expect(called).toBe(false);
    });
  });
});
