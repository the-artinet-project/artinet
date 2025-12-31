/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";
import { AgentConfigurationSchema } from "agent-def";
import { AgentLoader } from "../loader.js";

interface MigrationResult {
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
): Promise<MigrationResult> {
  const result: MigrationResult = {
    migratedFiles: [],
    failedFiles: [],
    skippedFiles: [],
  };

  // First, try loading agents with the current schema
  const loader = new AgentLoader();
  await loader.loadAgents(agentDir);

  // Process files with errors
  for (const errorEntry of loader.errors) {
    const filePath = errorEntry.filePath;

    try {
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
        migratedData.modelId = migratedData.model;
        delete migratedData.model;
        migrated = true;
      }

      // Transform: tools -> toolIds
      if (migratedData.tools && !migratedData.toolIds) {
        migratedData.toolIds = migratedData.tools;
        delete migratedData.tools;
        migrated = true;
      }

      // Transform: teams -> groupIds
      if (migratedData.teams && !migratedData.groupIds) {
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
        migratedData.skills = migratedData.skills.map((skill: any) => {
          if (!skill.tags) {
            migrated = true;
            return { ...skill, tags: [] };
          }
          return skill;
        });
      }

      if (!migrated) {
        result.skippedFiles.push(filePath);
        continue;
      }

      // Add instructions to data for validation
      migratedData.instructions = content.trim();

      // Validate against the new schema
      const parseResult = AgentConfigurationSchema.safeParse(migratedData);

      if (parseResult.success) {
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
        result.failedFiles.push({
          file: filePath,
          error: parseResult.error.message,
        });
      }
    } catch (error) {
      result.failedFiles.push({
        file: filePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}
