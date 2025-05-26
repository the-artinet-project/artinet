#!/usr/bin/env node
import prompts from "prompts";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import { templates } from "./option.js";
import {
  copyFilesAndDirectories,
  installDependencies,
  renamePackageJsonName,
} from "./create-project.js";
import ora, { Ora } from "ora";
import "./banner.js";

const projectNamePattern = /^[a-zA-Z0-9-]+$/;

(async () => {
  let spinner: Ora = ora("Creating project...");
  try {
    const response = await prompts([
      {
        type: "select",
        name: "template",
        message: "select a template",
        hint: "the echo agent is a great place to start",
        choices: templates,
      },
      {
        type: "text",
        name: "projectName",
        message: "Enter your project name",
        initial: "my-project",
        format: (val) => val.toLowerCase().split(" ").join("-"),
        validate: (val) =>
          projectNamePattern.test(val)
            ? true
            : "Project name should not contain special characters except hyphen (-)",
      },
    ]);
    const { projectName, template } = response;

    const cwd = process.cwd();
    const targetDir = path.join(cwd, projectName);
    const sourceDir = path.resolve(
      fileURLToPath(import.meta.url),
      "../../../templates",
      `${template}`
    );
    spinner = ora("Creating directory...").start();
    if (!fs.existsSync(targetDir)) {
      spinner.text = "Creating directory";
      fs.mkdirSync(targetDir, { recursive: true });
      spinner.text = "Copying files";
      await copyFilesAndDirectories(sourceDir, targetDir).catch((err) => {
        spinner.fail("Failed to copy files");
        throw err;
      });
      spinner.text = "Configuring package.json";
      await renamePackageJsonName(targetDir, projectName).catch((err) => {
        spinner.fail("Failed to configure package.json");
        throw err;
      });
      spinner.succeed(`Finished generating ${projectName}:`);
      spinner.text = "Installing dependencies";
      await installDependencies(targetDir, projectName, spinner).catch(
        (err) => {
          spinner.fail("Failed to install dependencies");
          throw err;
        }
      );
    } else {
      throw new Error("Target directory already exist!");
    }
    const templateFiles = fs.readdirSync(sourceDir);
    console.log(templateFiles);
  } catch (err: any) {
    spinner.fail("Creation failed:" + err.message);
    process.exit(1);
  }
})();
