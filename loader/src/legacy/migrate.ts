/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";
import { LoadedAgentSchema } from "../types/config.js";
import { Loader } from "../loader.js";
import { v4 as uuidv4 } from "uuid";
import { logger } from "@artinet/sdk";
interface Result {
  migratedFiles: string[];
  failedFiles: { file: string; error: string }[];
  skippedFiles: string[];
}

/**
 * Attempts to migrate legacy agent configurations to the new schema
 * @param agentDir Directory containing agent configuration files
 * @param targetDir Optional directory to write migrated files (defaults to overwriting source)
 * @returns Migration results with lists of migrated, failed, and skipped files
 */
export async function migrateAgents(
  agentDir: string,
  targetDir?: string
): Promise<Result> {
  const result: Result = {
    migratedFiles: [],
    failedFiles: [],
    skippedFiles: [],
  };

  // First, try loading agents with the current schema
  const loader = new Loader();
  await loader.loadAgents(agentDir);

  // Process files with errors
  for (const errorEntry of loader.errors) {
    const filePath = errorEntry.filePath;

    try {
      logger.info(`Migrating agent from ${filePath}`);
      // Read the file
      const fileContent = await fs.readFile(filePath, "utf8");
      const { data, content } = matter(fileContent);

      if (!content.trim()) {
        result.failedFiles.push({
          file: filePath,
          error: "No instructions found in file",
        });
        continue;
      }

      // Apply migration transformations
      let migrated = false;
      const migratedData = { ...data };


      // Transform: model -> modelId
      if (migratedData.model && !migratedData.modelId) {
        logger.debug(`Migrating model to modelId`, {
          model: migratedData.model,
        });
        migratedData.modelId = migratedData.model;
        delete migratedData.model;
        migrated = true;
      }

      // Transform: tools -> toolIds
      if (migratedData.tools && !migratedData.toolUris) {
        logger.debug(`Migrating tools to toolUris`, {
          tools: migratedData.tools,
        });
        migratedData.toolUris = migratedData.tools;
        delete migratedData.tools;
        migrated = true;
      }

      // Transform: teams -> groupIds
      if (migratedData.teams && !migratedData.groupIds) {
        logger.debug(`Migrating teams to groupIds`, {
          teams: migratedData.teams,
        });
        migratedData.groupIds = migratedData.teams.map((team: any) => {
          if (typeof team === "string") return team;
          if (team.name && team.role) {
            return `team:${team.name}:${team.role}`;
          }
          if (team.name) return `team:${team.name}`;
          return team;
        });
        delete migratedData.teams;
        migrated = true;
      }

      // Fix: skills need tags [] field
      if (migratedData.skills && Array.isArray(migratedData.skills)) {
        logger.debug(`Migrating skills to tags`, {
          skills: migratedData.skills,
        });
        migratedData.skills = migratedData.skills.map((skill: any) => {
          if (!skill.tags) {
            migrated = true;
            return { ...skill, tags: [] };
          }
          return skill;
        }) ?? [];
      }

      if (!migratedData.schemaVersion) {
        logger.debug(`Migrating schemaVersion to 0.1.0`, {
          schemaVersion: migratedData.schemaVersion,
        });
        migratedData.schemaVersion = "0.1.0";
        migrated = true;
      }

      if (!migratedData.uri) {
        migratedData.uri =
          migratedData.name ??
          migratedData.id ??
          uuidv4();
        logger.debug(`Migrating uri`, {
          uri: migratedData.uri,
        });
        migrated = true;
      }

      if (!migrated) {
        logger.debug(`Skipping agent ${filePath} as no migrations were applied`, {
          migratedData,
        });
        result.skippedFiles.push(filePath);
        continue;
      }

      // Add instructions to data for validation
      migratedData.instructions = content.trim();
      // Validate against the new schema
      const parseResult = LoadedAgentSchema.safeParse(migratedData);

      if (parseResult.success) {
        logger.info(`Successfully migrated agent ${filePath}`, {
          uri: migratedData.uri,
        });
        // Remove instructions before writing (it goes in the body)
        delete migratedData.instructions;

        // Determine output path
        const outputPath = targetDir
          ? path.join(
              targetDir,
              path.relative(path.resolve(agentDir), filePath)
            )
          : filePath;

        // Ensure output directory exists
        if (targetDir) {
          await fs.mkdir(path.dirname(outputPath), { recursive: true });
        }

        // Write the migrated file
        const newContent = matter.stringify(content, migratedData);
        await fs.writeFile(outputPath, newContent, "utf8");

        result.migratedFiles.push(outputPath);
      } else {
        logger.error(`Failed to migrate agent ${filePath}`, {
          error: parseResult.error,
        });
        result.failedFiles.push({
          file: filePath,
          error: parseResult.error.message,
        });
      }
    } catch (error) {
      logger.error(`Failed to migrate agent ${filePath}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      result.failedFiles.push({
        file: filePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}
