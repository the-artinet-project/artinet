#!/usr/bin/env node
import { spawn } from "child_process";
import {
  writeFile,
  lstat,
  readdir,
  mkdir,
  copyFile,
  readFile,
} from "fs/promises";
import { Ora } from "ora";
import path from "path";

const ignoreFiles = ["node_modules", "package-lock.json"];

export const copyFilesAndDirectories = async (source, destination) => {
  const entries = await readdir(source);

  for (const entry of entries) {
    const sourcePath = path.join(source, entry);
    if (ignoreFiles.some((file) => entry.includes(file))) {
      continue;
    }

    const destPath = path.join(destination, entry);

    const stat = await lstat(sourcePath);

    if (stat.isDirectory()) {
      // Create the directory in the destination
      await mkdir(destPath);

      // Recursively copy files and subdirectories
      await copyFilesAndDirectories(sourcePath, destPath);
    } else {
      // Copy the file
      await copyFile(sourcePath, destPath);
    }
  }
};

export const renamePackageJsonName = async (targetDir, projectName) => {
  const packageJsonPath = path.join(targetDir, "package.json");
  try {
    const packageJsonData = await readFile(packageJsonPath, "utf8");
    const packageJson = JSON.parse(packageJsonData);
    packageJson.name = projectName;
    await writeFile(
      packageJsonPath,
      JSON.stringify(packageJson, null, 2),
      "utf8"
    );
  } catch (err: any) {
    console.log(err.message);
  }
};

export const installDependencies = async (
  targetDir: string,
  projectName: string,
  spinner: Ora
) => {
  // Use 'npm.cmd' on Windows, 'npm' on other platforms
  const command = /^win/.test(process.platform) ? "npm.cmd" : "npm";
  const npmInstall = spawn(command, ["install"], {
    cwd: targetDir, // Run 'npm install' in the new project directory
    stdio: "inherit", // Show 'npm install' output directly in the console
  });

  npmInstall.on("close", (code) => {
    if (code === 0) {
      console.log("\n");
      spinner.succeed("Dependencies installed successfully.");
      spinner.succeed(`Done. Project ${projectName} is ready!`);
      console.log(`\nTo get started:`);
      console.log(`  cd ${projectName}`);
      console.log(
        `  npm start:with-chat (to run the agent with an lchat client)`
      );
      console.log(
        `\n  *dont forget to customize the agentCard in the ./lib/card.js file*`
      );
    } else {
      spinner.fail(
        `\nFailed to install dependencies. 'npm install' exited with code ${code}.`
      );
      console.log(
        `Please try running 'npm install' manually in the '${projectName}' directory.`
      );
    }
  });

  npmInstall.on("error", (err) => {
    spinner.fail("\nFailed to run 'npm install':" + err.message);
    console.log(
      `Please try running 'npm install' manually in the '${projectName}' directory.`
    );
    throw err;
  });
};
