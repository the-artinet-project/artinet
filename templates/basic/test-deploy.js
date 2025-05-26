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
          text: "Hello, how are you?",
        },
      ],
    },
  },
};

for await (const result of testDeployment(deployment, [testTask])) {
  console.log("testDeployment", "Received result:", JSON.stringify(result));
}
