import { ServerOptions } from "@modelcontextprotocol/sdk/server/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Implementation } from "@modelcontextprotocol/sdk/types.js";
import {
  BashRequest,
  BashResponse,
  BashRequestSchema,
} from "./types/schema.js";
import { BashSession } from "./session.js";
import { BannedCommands } from "./banned-command.js";
// A typescript implementation of Anthropic's BashTool20250124 as an MCP server
// references:
// - https://github.com/anthropics/claude-quickstarts/blob/main/computer-use-demo/computer_use_demo/tools/bash.py
// - https://docs.claude.com/en/docs/agents-and-tools/tool-use/bash-tool

class BashServer extends McpServer {
  //todo turn into a map of session ids to sessions
  private session: BashSession | null = null;
  private _bannedCommands: string[] = BannedCommands;
  constructor(
    info: Implementation = {
      name: "bash-mcp-server",
      version: "1.0.0",
    },
    options: ServerOptions = {},
    bannedCommands?: string[]
  ) {
    const fullBannedCommands = [...BannedCommands, ...(bannedCommands ?? [])];
    super(info, {
      ...options,
      instructions:
        options?.instructions +
        `Executes a given bash command in a persistent shell session with optional timeout, ensuring proper handling and security measures.
      Before executing the command, please follow these steps:
      1. Prefer Tools:
         - If the command will access the filesystem to search, grep, create new directories or files etc., use the secure-filesystem-server (if available) instead.
         - If the command will require fetching data from the internet, use the mcp-fetch server (if available) instead.
         - If the command will require the use of git, use the mcp-git server (if available) instead.
      2. Security Check:
         - For security and to limit the threat of a prompt injection attack, some commands are limited or banned. If you use a disallowed command, you will receive an error message explaining the restriction. Explain the error to the User.
         - Verify that the command is not one of the banned commands: ${fullBannedCommands?.join(
           ", "
         )}.
      3. Command Execution:
         - After ensuring proper quoting, execute the command.
         - Capture the output of the command.
      4. Output Processing:
         - The output may be truncated if contains too much data, before being returned to you.
         - Prepare the output for display to the user.
      5. Return Result:
         - Provide the processed output of the command.
         - If any errors occurred during execution, include those in the output.
      6. Limitations:
         - No interactive commands: Cannot handle vim, less, or password prompts.
         - No GUI applications: Command-line only
         - Session scope: Persists within conversation, lost between API calls
         - Output limits: Large outputs may be truncated
         - No streaming: Results returned after completion
      `,
    });
    this._bannedCommands = fullBannedCommands;
    this.init();
  }
  private init() {
    //todo maybe move restart to its own tool?
    this.registerTool(
      "bash",
      {
        title: "Bash",
        description: "Execute bash commands in a persistent session",
        inputSchema: BashRequestSchema.shape,
      },
      async (args) => await this.bash(args)
    );
  }

  //todo maybe handle sessionIds on the transport layer?
  async bash(args: BashRequest): Promise<BashResponse> {
    if (args.restart) {
      return await this.restartSession();
    }

    if (
      this.session === null ||
      this.session === undefined ||
      !this.session.sessionParams.started ||
      this.session.sessionParams.process === null ||
      this.session.sessionParams.process?.exitCode !== null ||
      this.session.sessionParams.process?.killed
    ) {
      if (args.stop && !args.command) {
        return {
          content: [
            {
              type: "text",
              text: "no session to stop",
            },
          ],
        };
      }
      this.session = new BashSession();
      await this.session.start(true);
    }

    if (args.command) {
      const commandParts = args.command?.split(/\s+/) || [];
      if (
        this._bannedCommands.some((cmd) =>
          commandParts.some((part) => part === cmd)
        )
      ) {
        return {
          content: [
            {
              type: "text",
              text: `unable to execute command ${args.command} because it contains a banned command.`,
            },
            {
              type: "text",
              text: `banned commands: ${this._bannedCommands?.join(", ")}`,
            },
          ],
        };
      }
      const result = await this.session.run(args.command).catch((error) => {
        return {
          output: undefined,
          errorOutput: error.message,
        };
      });
      if (args.stop) {
        await this.session?.stop();
        this.session = null;
      }
      return {
        content: [
          {
            type: "text",
            text: (result.output ?? result.errorOutput)?.trim(),
          },
          ...(result.errorOutput
            ? [{ type: "text" as const, text: `error: ${result.errorOutput}` }]
            : []),
        ],
      };
    } else if (args.stop) {
      await this.session?.stop();
      this.session = null;
      return {
        content: [
          {
            type: "text",
            text: "session has been stopped",
          },
        ],
      };
    }
    throw new Error("no command provided.");
  }

  private async restartSession(): Promise<BashResponse> {
    if (this.session) {
      await this.session.stop();
    }

    this.session = new BashSession();
    await this.session.start();
    return {
      content: [
        {
          type: "text",
          text: "tool has been restarted",
        },
      ],
    };
  }
}

export { BashServer };
