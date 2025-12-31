import { ChildProcess } from "child_process";
import { BashSessionResult } from "./schema.js";

export interface IBashSession {
  start(): Promise<void>;
  stop(): Promise<void>;
  run(command: string): Promise<BashSessionResult>;
}

export interface BashSessionParams {
  started: boolean;
  process: ChildProcess | null;
  isActive: boolean;
  command: string;
  output_delay: number;
  timeout: number;
  sentinel: string;
  timed_out: boolean;
}
