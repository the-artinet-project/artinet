import { spawn } from "child_process";

export function launchAsk() {
  console.log();
  let chatArgs: string[] = [];
  const chatFlagIndex = process.argv.indexOf("--with-chat");
  if (chatFlagIndex !== -1) {
    chatArgs = process.argv.slice(chatFlagIndex + 1);
  }
  if (chatArgs.length > 0) {
    console.log(`Starting chat with arguments: ${chatArgs.join(" ")}`);
  }
  console.log("🛑 Type [exit] to end the session");
  console.log();
  const chatProcess = spawn(
    "ask",
    ["-e", "http://localhost:3000/a2a", ...chatArgs],
    {
      stdio: "inherit",
      cwd: process.cwd(),
    }
  );
  chatProcess.on("exit", (code) => {
    if (code !== 0) {
      console.log(`\nChat process exited with code ${code}`);
    }
    console.log("\n🚨 Shutting down server and chat...");
    process.exit(code);
  });
  process.on("SIGINT", () => {
    console.log("\n🚨 Shutting down server and chat...");
    chatProcess.kill("SIGINT");
    process.exit(0);
  });
}
