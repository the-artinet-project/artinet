import {
  A2AClient,
  AgentCard,
  Message,
  getParts,
  TaskStatusUpdateEvent,
  TaskArtifactUpdateEvent,
  Task,
  TaskState,
} from "@artinet/sdk";
import chalk from "chalk";
import prompts from "prompts";
import { v4 as uuidv4 } from "uuid";

export async function chat(
  agentCard: AgentCard,
  client: A2AClient,
  taskId: string = uuidv4(),
  verbose: boolean = false
) {
  if (!client) {
    console.error(chalk.red("No client provided"));
    throw new Error("chat: no client provided");
  }
  const name = agentCard.name;
  const version = agentCard.version;
  const description = agentCard.description;
  console.log(`Connected to: ${chalk.bgWhite(`${name} v${version}`)}`);
  console.log(`Description: ${chalk.bgWhite(`${description}`)}`);
  if (verbose) {
    console.log(
      `Agent Card: \n${chalk.bgWhite(`${JSON.stringify(agentCard, null, 2)}`)}\n\n`
    );
    console.log(`Task ID: ${chalk.bgWhite(`${taskId.trim()}`)}`);
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

    const msg: Message = {
      messageId: uuidv4(),
      taskId: taskId,
      contextId: uuidv4(),
      kind: "message",
      role: "user",
      parts: [{ text: response.message, kind: "text" }],
    };
    console.log();
    if (verbose) {
      console.log(chalk.bgWhite(`📤 Sending message: ${msg.messageId}`));
    }
    try {
      const agentResponseSource = client.sendStreamingMessage({ message: msg });
      for await (const update of agentResponseSource) {
        let updateKind = "";
        if (verbose) {
          updateKind =
            chalk.bgWhite(
              `📥 Type: ${chalk.bgWhiteBright(
                chalk.black(update.kind.toUpperCase().replace("-", " "))
              )}`
            ) + " ";
          const state: TaskState | undefined =
            (update as TaskStatusUpdateEvent)?.status?.state ??
            (update as Task)?.status?.state ??
            undefined;
          if (state) {
            switch (state) {
              case TaskState.canceled:
                updateKind += chalk.bgYellowBright(`${state.toUpperCase()}`);
                break;
              case TaskState.failed:
                updateKind += chalk.bgRed(`${state.toUpperCase()}`);
                break;
              case TaskState.rejected:
                updateKind += chalk.bgRed(`${state.toUpperCase()}`);
                break;
              case TaskState["auth-required"]:
                updateKind += chalk.bgMagenta(`${state.toUpperCase()}`);
                break;
              case TaskState.unknown:
                updateKind += chalk.bgRedBright(`${state.toUpperCase()}`);
                break;
              case TaskState.submitted:
                updateKind += chalk.bgYellow(`${state.toUpperCase()}`);
                break;
              case TaskState["input-required"]:
                updateKind += chalk.bgMagenta(`${state.toUpperCase()}`);
                break;
              case TaskState.working:
                updateKind += chalk.bgBlueBright(`${state.toUpperCase()}`);
                break;
              case TaskState.completed:
                updateKind += chalk.bgGreen(`${state.toUpperCase()}`);
                break;
            }
            updateKind += " ";
          }
        }
        if ((update.kind === "message" || update.kind === "task") && !verbose) {
          continue;
        }
        const response: string = getParts(
          (update as TaskStatusUpdateEvent)?.status?.message?.parts ??
            (update as TaskArtifactUpdateEvent)?.artifact?.parts ??
            (update as Message)?.parts ??
            (update as Task)?.status?.message?.parts ??
            []
        ).text;

        if (response) {
          console.log(updateKind + chalk.gray("Agent: ") + response);
        }
      }
    } catch (error) {
      console.error(chalk.red("Error sending message: ") + error);
    }
    console.log();
  }
}
