/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from "fs/promises";
import { v4 as uuidv4 } from "uuid";
import glob from "fast-glob";
import matter from "gray-matter";
import pLimit from "p-limit";
import path from "path";
import {
  Config,
  LoadError,
  LoadResults,
  Delta,
  UnresolvedAgentSchema,
  UnresolvedAgent,
  LoadedAgentSchema
} from "./types/config.js";
import { logger } from "@artinet/sdk";
/**
 * Loads and validates agent definitions from frontmatter markdown files
 */
export class Loader {
  public config: Config;
  public errors: LoadError[] = [];
  public agentUris = new Set<string>();
  public agents: Record<string, Delta> = {};

  constructor(config: Partial<Config> = {}) {
    this.config = {
      threads: 10,
      availableTools: [],
      fileExtensions: [".md", ".markdown"],
      ...config,
    };
  }

  /**
   * Loads agents from a directory or single file
   * @param targetPath Path to directory or file
   * @returns Complete loading result with agents, teams, and errors
   */
  async loadAgents(targetPath: string): Promise<LoadResults> {
    this.reset();
    const absolutePath = path.resolve(targetPath);
    if (targetPath.endsWith(".md")) {
      await this.processFile(absolutePath);
      return {
        deltas: this.agents,
        errors: this.errors,
      };
    }
    const files = await glob(`**/*.md`, {
      absolute: true,
      cwd: absolutePath,
      ignore: [
        "**/node_modules/**",
        "**/dist/**",
        "**/.git/**",
        "**/.DS_Store/**",
      ],
    });
    if (files.length === 0) {
      throw new Error(`No Agent configuration files found in ${absolutePath}`);
    }
    const limit = pLimit(this.config.threads);
    await Promise.allSettled(
      files.map(
        async (file) =>
          await limit(async () => {
            await this.processFile(file);
          })
      )
    );
    return {
      deltas: this.agents,
      errors: this.errors,
    };
  }

  /**
   * Resets internal state for fresh loading
   */
  private reset(): void {
    this.agents = {};
    this.errors = [];
    this.agentUris.clear();
  }

  /**
   * Loads a single agent definition file
   */
  private async processFile(filePath: string): Promise<void> {
    let unresolvedAgent: UnresolvedAgent;
    let _errors: any[] = [];
    let agentUri: string;
    try {
      const fileContent = await fs.readFile(filePath, "utf8");
      if (fileContent.trim() === "") {
        throw new Error("No content found in file");
      }

      const { data, content } = matter(fileContent);
      if (content.trim() === "") {
        throw new Error("No Instructions found in file");
      }

      data.instructions = content.trim();
      const parseResult = UnresolvedAgentSchema.safeParse(data);
      if (!parseResult.success) {
        throw new Error(
          `Failed to parse agent definition: ${parseResult.error.message}`
        );
      }
      unresolvedAgent = parseResult.data;
      unresolvedAgent.uri;

      if (!unresolvedAgent.uri) {
        unresolvedAgent.uri = unresolvedAgent.name ?? uuidv4();
      } else if (this.agentUris.has(unresolvedAgent.uri)) {
        throw new Error(`Duplicate agent URI: ${unresolvedAgent.uri}`);
      }
      
      agentUri = unresolvedAgent.uri;
      this.agents[agentUri] = {
        sourceFile: filePath,
        config: LoadedAgentSchema.parse(unresolvedAgent),
        client: false,
      };
      
      this.agentUris.add(agentUri);
      logger.info(`Loaded agent from ${filePath}`, {
        uri: agentUri,
      });
    } catch (error) {
      logger.error(`Failed to load agent from ${filePath}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      _errors.push({
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        ...(error instanceof Error && "cause" in error
          ? { cause: error.cause }
          : {}),
      });
    }
    if (_errors.length > 0) {
      this.errors.push({ filePath, errors: _errors });
    }
  }
}

export async function loadAgents(agentDir: string): Promise<Loader> {
  const agentLoader = new Loader();

  try {
    await agentLoader.loadAgents(agentDir);
  } catch (error) {
    console.error(`Failed to load agents from ${agentDir}:`, error);
    throw error;
  }

  return agentLoader;
}
