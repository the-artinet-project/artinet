import { testDeployment } from "@artinet/sdk";
import { deployment } from "./lib/deployment.js";

const testTask = {
  method: "tasks/send",
  params: {
    id: `task-${Date.now()}`,
    message: {
      role: "user",
      parts: [
        {
          type: "text",
          text: "Write a python function to share files remotely. Please be concise and respond with code only. Please use the following format: def share_files(files: list[str]) -> str: ...",
        },
      ],
    },
  },
};

for await (const result of testDeployment(deployment, [testTask])) {
  console.log(
    "testDeployment",
    "Received result:",
    JSON.stringify(result, null, 2),
    "\n"
  );
}
