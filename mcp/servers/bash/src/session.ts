import {
  BashSessionParams,
  BashSessionResult,
  IBashSession,
} from "./types/index.js";
import { spawn } from "child_process";

//todo add session id to the request

export class BashSession implements IBashSession {
  public sessionParams: BashSessionParams;
  private controller = new AbortController();
  constructor(
    params: BashSessionParams = {
      started: false,
      process: null,
      isActive: false,
      command: "/bin/bash",
      output_delay: 200, // 200ms
      timeout: 120000, // 2 minutes
      sentinel: "<<exit>>",
      timed_out: false,
    }
  ) {
    this.sessionParams = params;
  }
  async start(force: boolean = false) {
    if (this.sessionParams.started && !force) {
      throw new Error("Session has already started");
    } else if (this.sessionParams.started && force) {
      await this.stop();
    }
    this.sessionParams.process = spawn(this.sessionParams.command, [], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, PS1: "" },
      signal: this.controller.signal,
      detached: true,
      shell: true,
      timeout: this.sessionParams.timeout,
    });
    this.sessionParams.started = true;
  }
  /**
   * Stops the bash session.
   * Attempts to exit with extreme prejudice by sending SIGTERM and waiting for the process to exit.
   * If the process does not exit within 1 second, it will be killed with SIGKILL.
   **/
  async stop() {
    if (!this.sessionParams.started) {
      throw new Error("Session has not started");
    }
    if (this.sessionParams.process?.exitCode !== null) {
      return;
    }
    try {
      this.sessionParams.process?.stdin?.write("exit\n");
      await new Promise((resolve) => setTimeout(resolve, 100));
      this.sessionParams.process?.stdin?.destroy();
      await new Promise((resolve) => setTimeout(resolve, 100));
      this.sessionParams.process?.stdout?.destroy();
      this.sessionParams.process?.stderr?.destroy();
      this.sessionParams.process?.stderr?.removeAllListeners();
      this.sessionParams.process?.stdout?.removeAllListeners();
      this.sessionParams.process?.removeAllListeners();
    } catch (error) {
      console.error("Could not send SIGTERM to process:", error);
      await this.sessionParams.process?.kill?.("SIGKILL");
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
    this.sessionParams.started = false;
    this.sessionParams.isActive = false;
    this.sessionParams.process = null;
  }

  async run(command: string): Promise<BashSessionResult> {
    if (!this.sessionParams.started) {
      throw new Error("Session has not started");
    }

    if (this.sessionParams.isActive) {
      throw new Error("Session is already active");
    }
    this.sessionParams.isActive = true;

    if (this.sessionParams.process?.exitCode !== null) {
      throw new Error(
        "bash has exited with returncode " +
          this.sessionParams.process?.exitCode +
          "tool must be restarted"
      );
    }
    if (this.sessionParams.timed_out) {
      throw new Error(
        "timed out: bash has not returned in " +
          this.sessionParams.timeout / 1000 +
          " seconds and must be restarted"
      );
    }
    if (this.sessionParams.process?.stdin === null) {
      throw new Error("stdin is not available");
    }
    if (this.sessionParams.process?.stdout === null) {
      throw new Error("stdout is not available");
    }
    if (this.sessionParams.process?.stderr === null) {
      throw new Error("stderr is not available");
    }
    const executionPromise = new Promise(async (resolve) => {
      await this.sessionParams.process?.stdin?.write(
        `${command}; echo '${this.sessionParams.sentinel}'\n`,
        resolve
      );
    });
    let output: string | undefined = undefined;
    let errorOutput: string | undefined = undefined;
    let timeoutId: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise(
      (_, reject) =>
        (timeoutId = setTimeout(
          () => reject(new Error("timeout")),
          this.sessionParams.timeout
        ))
    );
    try {
      await Promise.race([
        timeoutPromise,
        new Promise(async (resolve) => {
          this.sessionParams.process?.stdout?.on("data", async (data) => {
            await new Promise((innerResolve) =>
              setTimeout(innerResolve, this.sessionParams.output_delay)
            );
            let text: string = data.toString();
            if (text.includes(this.sessionParams.sentinel)) {
              text = text.replace(this.sessionParams.sentinel, "");
              output = output ? output + text : text;
              resolve(output);
              return;
            }
            output = output ? output + text : text;
            return;
          });
          this.sessionParams.process?.stderr?.on("data", async (data) => {
            // immediately resolve on error
            // await new Promise((resolve) =>
            //   setTimeout(resolve, this.sessionParams.output_delay)
            // );
            let text: string = data.toString();
            if (text.includes(this.sessionParams.sentinel)) {
              text = text.replace(this.sessionParams.sentinel, "");
            }
            errorOutput = errorOutput ? errorOutput + text : text;
            //wait for a delay to ensure more error output is captured
            await new Promise((innerResolve) =>
              setTimeout(innerResolve, this.sessionParams.output_delay)
            );
            resolve(errorOutput);
            return;
          });
          await executionPromise;
        }),
      ]);
    } catch (error) {
      if (error instanceof Error && error.message === "timeout") {
        this.sessionParams.timed_out = true;
        throw new Error(
          "timed out: bash has not returned in " +
            this.sessionParams.timeout / 1000 +
            " seconds and must be restarted"
        );
      }
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      this.sessionParams.isActive = false;
    }
    output = output;
    errorOutput = errorOutput;
    this.sessionParams.process?.stderr?.removeAllListeners("data");
    this.sessionParams.process?.stdout?.removeAllListeners("data");
    return {
      output: output,
      errorOutput: errorOutput,
    };
  }
}
