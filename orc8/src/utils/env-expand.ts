/**
 * @fileoverview
 * Environment variable expansion utilities for shell command arguments.
 *
 * This module provides cross-platform environment variable expansion,
 * enabling MCP server configurations to include shell variables like
 * `$HOME`, `$USER`, or `%USERPROFILE%` that get resolved at runtime.
 *
 * Supports:
 * - Unix-style variables: `$HOME`, `$PATH`, `${VAR_NAME}`
 * - Windows-style variables: `%USERPROFILE%`, `%PATH%`
 *
 * @example
 * ```typescript
 * // Expand environment variables in command arguments
 * const args = envArgsCapture([
 *   "-y",
 *   "@mcp/server-filesystem",
 *   "$HOME/documents"  // Becomes "/home/user/documents" on Unix
 * ]);
 * ```
 *
 * @module utils/env-expand
 * @license Apache-2.0
 *
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import { execSync } from "child_process";
import { platform } from "os";
import { logger } from "@artinet/sdk";

/**
 * Expands shell environment variables in a string.
 *
 * Uses the native shell to expand variables, ensuring compatibility
 * with the user's environment configuration.
 *
 * @param variable - The string potentially containing shell variables
 * @returns The string with variables expanded, or original on failure
 *
 * @example
 * ```typescript
 * expandShellVariable("$HOME/docs")  // "/home/user/docs"
 * expandShellVariable("plain text")  // "plain text"
 * ```
 *
 * @internal
 */
function expandShellVariable(variable: string): string {
  try {
    const isWindows = platform() === "win32";

    if (isWindows) {
      const result = execSync(`cmd /c echo ${variable}`, {
        encoding: "utf8",
        stdio: "pipe",
      });
      return result.trim();
    } else {
      const result = execSync(`sh -c 'echo ${variable}'`, {
        encoding: "utf8",
        stdio: "pipe",
      });
      return result.trim();
    }
  } catch (error) {
    logger.warn(`Failed to expand variable ${variable}:`, error);
    return variable;
  }
}

/**
 * Expands environment variables in an array of command arguments.
 *
 * Processes each argument through the shell's variable expansion,
 * enabling dynamic path resolution in MCP server configurations.
 *
 * @param args - Array of command arguments to process
 * @returns Array with all environment variables expanded
 *
 * @example
 * ```typescript
 * const args = envArgsCapture([
 *   "-y",
 *   "@mcp/server-filesystem",
 *   "$HOME/documents",
 *   "$USER"
 * ]);
 * // Returns: ["-y", "@mcp/server-filesystem", "/home/alice/documents", "alice"]
 * ```
 */
export function envArgsCapture(args: string[]): string[] {
  return args.map((arg) => expandShellVariable(arg));
}
