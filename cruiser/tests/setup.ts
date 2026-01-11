import { jest } from "@jest/globals";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

if (!Symbol.dispose) {
  (Symbol as any).dispose = Symbol.for("Symbol.dispose");
}

if (!Symbol.asyncDispose) {
  (Symbol as any).asyncDispose = Symbol.for("Symbol.asyncDispose");
}

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from root
config({ path: resolve(__dirname, "../../.env") });

// Default timeout for unit tests
jest.setTimeout(10000);

// Extended timeout for integration tests (60 seconds)
export const INTEGRATION_TIMEOUT = 60000;
