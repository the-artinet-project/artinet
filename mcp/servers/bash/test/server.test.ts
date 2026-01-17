import { BashServer, BashSession } from "../src/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { CallToolResult, TextContent } from "@modelcontextprotocol/sdk/types.js";
import {
  jest,
  describe,
  beforeEach,
  afterEach,
  it,
  expect,
} from "@jest/globals";

//inspired by: https://github.com/anthropics/claude-quickstarts/blob/main/computer-use-demo/tests/tools/bash_test.py
jest.setTimeout(10000);
describe("BashMCPServer", () => {
  let server: BashServer;

  beforeEach(() => {
    server = new BashServer();
  });

  afterEach(async () => {
    const response = await server.bash({ stop: true }).catch((error) => {
      console.error("Error cleaning up session:", error);
    });
    expect(response?.content[0].text).toMatch(
      /session has been stopped|no session to stop/i
    );
  });

  describe("Command Execution", () => {
    it("should execute simple command", async () => {
      await server.bash({ restart: true });
      const response = await server.bash({ command: "echo 'Hello, World!'" });

      expect(response.content).toBeDefined();
      expect(response.content).toHaveLength(1);
      expect(response.content[0].type).toBe("text");
      expect(response.content[0].text).toContain("Hello, World!");
    });

    it("should chain commands", async () => {
      await server.bash({ command: "TEST_VAR='session_test'" });
      const response = await server.bash({ command: "echo $TEST_VAR" });
      expect(response.content[0].text).toContain("session_test");
    });

    it("should handle bad command", async () => {
      const response = await server.bash({ command: "nonexistentcommand" });
      expect(response.content).toBeDefined();
      expect(response.content[0].text).toBe(
        "/bin/bash: line 1: nonexistentcommand: command not found"
      );
    });

    it("should execute multiline", async () => {
      const multilineCommand = `for i in 1 2 3; do
        echo "Number: $i"
      done`;

      const response = await server.bash({ command: multilineCommand });
      expect(response.content[0].text).toBe("Number: 1\nNumber: 2\nNumber: 3");
    });

    it("should handle files", async () => {
      await server.bash({
        command: "echo 'test content' > /tmp/bash_test_file.txt",
      });
      const response = await server.bash({
        command: "cat /tmp/bash_test_file.txt",
      });
      expect(response.content[0].text).toBe("test content");
      await server.bash({ command: "rm -f /tmp/bash_test_file.txt" });
      await server.bash({ restart: true });
      const checkResponse = await server.bash({
        command: "cat /tmp/bash_test_file.txt",
      });
      expect(checkResponse.content[0].text).toBe(
        "cat: /tmp/bash_test_file.txt: No such file or directory"
      );
    });

    it("should handle dir change", async () => {
      await server.bash({ command: "cd /tmp" });
      const response = await server.bash({ command: "pwd" });
      expect(response.content[0].text).toBe("/tmp");
    });
  });

  describe("Session Management", () => {
    it("should restart", async () => {
      await server.bash({ command: "RESTART_TEST='before_restart'" });
      const restartResponse = await server.bash({ restart: true });
      expect(restartResponse.content[0].text).toBe("tool has been restarted");
      const response = await server.bash({
        command: 'echo "VAR_VALUE: $RESTART_TEST"',
      });
      expect(response.content[0].text).toBe("VAR_VALUE:");
    });

    it("should handle restart", async () => {
      const response = await server.bash({ restart: true });
      expect(response.content[0].text).toBe("tool has been restarted");
    });
    it("should work after a restart", async () => {
      const response = await server.bash({ restart: true });
      expect(response.content[0].text).toBe("tool has been restarted");
      const response2 = await server.bash({ command: "echo 'Hello, World!'" });
      expect(response2.content[0].text).toBe("Hello, World!");
    });
    //todo tests for sessionIds
  });

  describe("Error Handling", () => {
    it("should throw error with no command", async () => {
      await expect(server.bash({})).rejects.toThrow("no command provided");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty response", async () => {
      const response = await server.bash({ command: "true" });
      expect(response.content[0].text).toBeDefined();
      expect(response.content[0].text).toBe("");
    });

    it("should handle special char", async () => {
      const response = await server.bash({
        command: "echo 'Special chars: !@#$%^&*()'",
      });
      expect(response.content[0].text).toBe("Special chars: !@#$%^&*()");
    });

    it("should handle quotes", async () => {
      const response = await server.bash({
        command: 'echo "This is a \\"quoted\\" string"',
      });
      expect(response.content[0].text).toBe('This is a "quoted" string');
    });
    it("should handle non zero exit code", async () => {
      const response = await server.bash({ command: "bash -c 'exit 1'" });
      expect(response.content[0].text).toBe("");
    });
  });
  describe("Timeout", () => {
    let session: BashSession;
    beforeEach(async () => {
      session = new BashSession({
        started: false,
        process: null,
        isActive: false,
        command: "/bin/bash",
        output_delay: 200,
        timeout: 1000,
        sentinel: "<<exit>>",
        timed_out: false,
      });
      await session.start();
    });
    afterEach(async () => {
      await session.stop();
    });
    it("should handle timeout", async () => {
      await expect(session.run("sleep 10")).rejects.toThrow(
        "timed out: bash has not returned in 1 seconds and must be restarted"
      );
    });
  });
  describe("STDIO", () => {
    it("should work with stdio transport", async () => {
      const transport = new StdioClientTransport({
        command: "node",
        args: ["dist/bin/stdio.js"],
      });
      const client = new Client({ name: "Bash Client", version: "1.0.0" }, {});
      await client.connect(transport);
      const response = await client.callTool({
        name: "bash",
        arguments: {
          command: "echo 'Hello, World!'",
          stop: true,
        },
      });
      expect(((response as CallToolResult).content[0] as TextContent).text).toBe(
        "Hello, World!"
      );
      await client.close();
      await transport.close();
    }, 10000);
    it("should work echo input", async () => {
      const transport = new StdioClientTransport({
        command: "node",
        args: ["dist/bin/stdio.js"],
      });
      const client = new Client({ name: "Bash Client", version: "1.0.0" }, {});
      await client.connect(transport);
      const response = await client.callTool({
        name: "bash",
        arguments: {
          command: "echo 'Testing bash tool functionality'",
          stop: true,
        },
      });
      expect(((response as CallToolResult).content[0] as TextContent).text).toBe(
        "Testing bash tool functionality"
      );
      await client.close();
      await transport.close();
    }, 10000);
    it("should work with stdio transport and banned commands", async () => {
      const transport = new StdioClientTransport({
        command: "node",
        args: ["dist/bin/stdio.js", "rm", "rm -rf"],
      });
      const client = new Client({ name: "Bash Client", version: "1.0.0" }, {});
      await client.connect(transport);
      const response = await client.callTool({
        name: "bash",
        arguments: {
          command: "rm -rf /",
          stop: true,
        },
      });
      expect(((response as CallToolResult).content[0] as TextContent).text).toBe(
        "unable to execute command rm -rf / because it contains a banned command."
      );
      await client.close();
      await transport.close();
    }, 10000);
    it("should work after a restart", async () => {
      const transport = new StdioClientTransport({
        command: "node",
        args: ["dist/bin/stdio.js"],
      });
      const client = new Client({ name: "Bash Client", version: "1.0.0" }, {});
      await client.connect(transport);
      const response = await client.callTool({
        name: "bash",
        arguments: {
          command: "echo 'Hello, World!'",
        },
      });
      expect(((response as CallToolResult).content[0] as TextContent).text).toBe(
        "Hello, World!"
      );
      await client.callTool({
        name: "bash",
        arguments: {
          restart: true,
        },
      });
      const response2 = await client.callTool({
        name: "bash",
        arguments: {
          command: "echo 'Hello, World!'",
        },
      });
      expect(((response2 as CallToolResult).content[0] as TextContent).text).toBe(
        "Hello, World!"
      );
      await client.close();
      await transport.close();
    }, 10000);
    it("should work after long delay", async () => {
      const transport = new StdioClientTransport({
        command: "node",
        args: ["dist/bin/stdio.js"],
      });
      const client = new Client({ name: "Bash Client", version: "1.0.0" }, {});
      await client.connect(transport);
      const response = await client.callTool({
        name: "bash",
        arguments: {
          command: "echo 'Hello, World!'",
        },
      });
      expect(((response as CallToolResult).content[0] as TextContent).text).toBe(
        "Hello, World!"
      );
      await new Promise((resolve) => setTimeout(resolve, 120000));
      const response2 = await client.callTool({
        name: "bash",
        arguments: {
          command: "echo 'Hello, World!'",
        },
      });
      expect(((response2 as CallToolResult).content[0] as TextContent).text).toBe(
        "Hello, World!"
      );
      await client.close();
      await transport.close();
    }, 180000);

    it("should work with long running command", async () => {
      const transport = new StdioClientTransport({
        command: "node",
        args: ["dist/bin/stdio.js"],
      });
      const client = new Client({ name: "Bash Client", version: "1.0.0" }, {});
      await client.connect(transport);
      const response = await client.callTool({
        name: "bash",
        arguments: {
          command:
            "cd /home/pattp/.local/share/emoji_dir && npm test -- --config=jest.config.js",
        },
      });
      expect(((response as CallToolResult).content[0] as TextContent).text).toBeDefined();
      await client.close();
      await transport.close();
    });
  });
});
