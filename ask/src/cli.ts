#!/usr/bin/env node
/**
 * @fileoverview A simple chat client for connecting to A2A Servers
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */

import * as sdk from "@artinet/sdk";
import { Command } from "commander";
import { chat } from "./chat.js";
import chalk from "chalk";

const program = new Command();
program
  .name("ask")
  .description("A lightweight chat client for connecting to A2A Servers")
  .version("0.0.8")
  .option("-v, --verbose", "Enable verbose output")
  .option("-t, --task <taskId>", "Set the task ID")
  .option(
    "-e, --endpoint <endpoint>",
    "Set the A2A endpoint (default: http://localhost:3000/a2a)"
  )
  .option("-c, --card", "Show the agent card")
  .option("-m, --message <message>", "Send a single message and exit")
  .action(async (options) => {
    let client: sdk.A2AClient | undefined;
    try {
      client = new sdk.A2AClient(
        options?.endpoint ?? "http://localhost:3000/a2a",
        undefined,
        undefined,
        true
      );
    } catch (error) {
      console.error(chalk.red("Error creating client:"));
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
    if (!client) {
      console.error(chalk.red("Failed to create client"));
      process.exit(1);
    }
    let agentCard = await client.agentCard().catch((error) => {
      console.error(chalk.red("Error getting agent card:"));
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
    (client as any).agentUrl = new URL(
      options?.endpoint ?? (client as any).agentUrl
    );
    if (options?.card) {
      console.log();
      console.log(
        `Agent Card:\n\n${chalk.bgWhiteBright(
          JSON.stringify(agentCard, null, 2)
        )}`
      );
      process.exit(0);
    }
    await chat(
      agentCard,
      client,
      options?.task?.trim() || undefined,
      options?.verbose,
      options?.message?.trim()
    );
    process.exit(0);
  });

program.configureHelp({
  sortSubcommands: true,
  showGlobalOptions: false,
});

program.on("command:*", () => {
  console.error(chalk.red(`Unknown command: ${program.args.join(" ")}`));
  console.log(chalk.yellow("See --help for available commands."));
  process.exit(1);
});

program.on("exit", () => {
  console.error(chalk.red(`Exiting...`));
  process.exit(0);
});

program.parse();
