import * as sdk from "@artinet/sdk";
import chalk from "chalk";
import prompts from "prompts";
import { v4 as uuidv4 } from "uuid";

// sdk.applyDefaults();

function getTaskState(update: sdk.A2A.Update): sdk.A2A.TaskState | undefined {
  const state: sdk.A2A.TaskState | undefined =
    (update as sdk.A2A.TaskStatusUpdateEvent)?.status?.state ??
    (update as sdk.A2A.Task)?.status?.state ??
    undefined;
  return state;
}

function createBanner(
  kind: sdk.A2A.Kind,
  state: sdk.A2A.TaskState | undefined,
  verbose: boolean = false
): string {
  let banner = "";

  if (verbose) {
    banner =
      chalk.bgWhite(
        chalk.grey(
          `📥 Type: ${chalk.bgWhiteBright(
            chalk.black(kind.toUpperCase().replace("-", " "))
          )}`
        )
      ) + " ";
  }

  if (state) {
    switch (state) {
      case sdk.A2A.TaskState.canceled:
        banner = chalk.bgYellowBright(`${state.toUpperCase()}`);
        break;
      case sdk.A2A.TaskState.failed:
        banner = chalk.bgRed(`${state.toUpperCase()}`);
        break;
      case sdk.A2A.TaskState.rejected:
        banner = chalk.bgRed(`${state.toUpperCase()}`);
        break;
      case sdk.A2A.TaskState["auth-required"]:
        banner = chalk.bgMagenta(`${state.toUpperCase()}`);
        break;
      case sdk.A2A.TaskState.unknown:
        banner = chalk.bgRedBright(`${state.toUpperCase()}`);
        break;
      case sdk.A2A.TaskState.submitted:
        banner = chalk.bgYellow(chalk.black(`${state.toUpperCase()}`));
        break;
      case sdk.A2A.TaskState["input-required"]:
        banner = chalk.bgMagenta(chalk.black(`${state.toUpperCase()}`));
        break;
      case sdk.A2A.TaskState.working:
        banner = chalk.bgBlueBright(`${state.toUpperCase()}`);
        break;
      case sdk.A2A.TaskState.completed:
        banner = chalk.bgGreen(`${state.toUpperCase()}`);
        break;
    }
  }
  if (banner.length > 0 && banner[banner.length - 1] !== " ") {
    return banner + " ";
  }
  return banner;
}

async function sendMessage(
  client: sdk.AgentMessenger,
  message: string,
  taskId: string,
  verbose: boolean = false
) {
  const msg: sdk.A2A.Message = {
    messageId: uuidv4(),
    taskId: taskId,
    kind: sdk.A2A.Kind.message,
    role: "user",
    parts: [{ text: message, kind: "text" }],
  };

  if (verbose) {
    console.log(
      chalk.bgWhite(chalk.black(`📤 Sending message: ${msg.messageId}`))
    );
  }

  const agentResponseSource: sdk.A2A.Message | sdk.A2A.Task | null =
    await client.sendMessage({
      message: msg,
    });

  if (!agentResponseSource) {
    console.error(chalk.red("No response from agent"));
    return;
  }

  const banner = createBanner(
    agentResponseSource.kind,
    getTaskState(agentResponseSource),
    verbose
  );

  console.log(
    banner + chalk.gray("Agent: ") + sdk.getContent(agentResponseSource)
  );
  console.log();
}

export async function chat(
  agentCard: sdk.A2A.AgentCard,
  client: sdk.AgentMessenger,
  taskId: string = uuidv4(),
  verbose: boolean = false,
  message: string | undefined = undefined
) {
  if (!client) {
    console.error(chalk.red("No client provided"));
    throw new Error("chat: no client provided");
  }
  const name = agentCard.name;
  const version = agentCard.version;
  const description = agentCard.description;
  console.log(
    `Connected to: ${chalk.bgWhite(chalk.black(`${name} v${version}`))}`
  );
  console.log(`Description: ${chalk.bgWhite(chalk.black(`${description}`))}`);
  if (verbose) {
    console.log(
      `Agent Card: \n${chalk.bgWhite(
        chalk.black(`${JSON.stringify(agentCard, null, 2)}`)
      )}\n\n`
    );
    console.log(`Task ID: ${chalk.bgWhite(chalk.black(`${taskId.trim()}`))}`);
  }

  if (message) {
    console.log();
    return await sendMessage(client, message, taskId, verbose);
  }

  console.log();
  console.log(chalk.bgGray("Chat started: Type 'exit' to quit.\n"));
  while (true) {
    const response = await prompts({
      type: "text",
      name: "message",
      message: "User:",
    });
    if (!response.message || response.message.trim().toLowerCase() === "exit") {
      break;
    }

    const msg: sdk.A2A.Message = {
      messageId: uuidv4(),
      taskId: taskId,
      kind: sdk.A2A.Kind.message,
      role: "user",
      parts: [{ text: response.message, kind: "text" }],
    };
    console.log();
    if (verbose) {
      console.log(
        chalk.bgWhite(chalk.black(`📤 Sending message: ${msg.messageId}`))
      );
    }
    try {
      const agentResponseSource = client.sendMessageStream({
        message: msg,
      });
      for await (const update of agentResponseSource) {
        const banner = createBanner(update.kind, getTaskState(update), verbose);

        if ((update.kind === "message" || update.kind === "task") && !verbose) {
          continue;
        }
        const response: string = sdk.getContent(update) ?? "No response";
        if (response) {
          console.log(banner + chalk.gray("Agent: ") + response);
        } else if (verbose && banner.length > 0) {
          console.log(banner + chalk.gray("Status Update: ☑️"));
        }
      }
    } catch (error) {
      console.error(chalk.red("Error sending message: ") + error);
    }
    console.log();
  }
}
