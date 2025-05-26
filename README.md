# `@artinet/create-quick-agent`

A command-line interface (CLI) tool to quickly scaffold starter agent projects from a predefined set of templates. `create-quick-agent` streamlines the initial setup process, allowing you to get your new agent project up and running in minutes.

## Features

*   **Interactive Setup:** Guides you through selecting a template and naming your project.
*   **Variety of Templates:** Choose from several starter agent templates to fit different needs.
*   **Automatic Project Scaffolding:** Creates a new project directory, copies template files, and configures basic project settings.
*   **Dependency Management:** Automatically installs necessary dependencies using `npm`.
*   **Customizable:** Templates are designed to be a starting point for your custom agent development.

## Prerequisites

*   [Node.js](https://nodejs.org/) (version 22.x or higher recommended, check `package.json` for specific engine requirements)
*   `npm` (comes with Node.js)

## Installation & Usage

The easiest way to use `create-quick-agent` is with `npx`, which ensures you're always using the latest version:

```bash
npx @artinet/create-quick-agent@latest
```

This command will initiate an interactive session:

1.  **Select a Template:** You'll be prompted to choose from the available agent templates.
    ```
    ? Select template › - Use arrow-keys. Return to submit.
    ❯   basic
        coder
        orchestrator
    ```
2.  **Enter Project Name:** You'll be asked to provide a name for your new project. This name will be used for the directory and in the project's `package.json`.
    ```
    ? Enter your project name › my-new-agent
    ```

Once you provide these inputs, `create-quick-agent` will:
*   Create a new directory with your chosen project name.
*   Copy the files from the selected template into this new directory.
*   Update the `name` field in the new project's `package.json` to match your project name.
*   Run `npm install` within the new project directory to install all necessary dependencies.
*   Finally, it will print out instructions on how to navigate into your new project and start developing.

## Available Templates

`create-quick-agent` currently offers the following templates:

*   **`basic`**: A minimal agent template, perfect for understanding the core structure or for simple agent tasks.
*   **`coder`**: A template pre-configured for developing agents with a focus on code generation, understanding, or manipulation tasks.
*   **`orchestrator`**: A template designed for building orchestrator agents that can manage and coordinate multiple other agents or tasks.

## How It Works

The `create-quick-agent` CLI tool performs the following steps internally:

1.  **Initialization (`src/index.ts`):**
    *   Displays a welcome banner (if `banner.ts` is used).
    *   Uses the `prompts` library to interactively ask the user for:
        *   The desired template (defined in `src/option.ts`).
        *   The name for the new project.
2.  **Project Creation (`src/create-project.ts` & `src/index.ts`):**
    *   **Directory Setup:**
        *   Resolves the path for the new project directory based on the current working directory and the user-provided project name.
        *   Checks if the target directory already exists to prevent overwriting. If it does, an error is thrown.
        *   Creates the new project directory.
    *   **Template Copying:**
        *   The `copyFilesAndDirectories` function (in `src/create-project.ts`) recursively copies all files and subdirectories from the selected template's folder (e.g., `templates/basic/`) into the newly created project directory.
    *   **Package Personalization:**
        *   The `renamePackageJsonName` function (in `src/create-project.ts`) reads the `package.json` file from the copied template within the new project directory.
        *   It then updates the `name` property in this `package.json` to match the project name provided by the user.
3.  **Dependency Installation (`src/index.ts`):**
    *   The script uses Node.js's `child_process.spawn` to execute `npm install` (or `npm.cmd` on Windows) within the new project directory.
    *   The output of `npm install` is streamed to the user's console (`stdio: "inherit"`) so they can see the installation progress.
    *   Error handling is in place to report if `npm install` fails.
4.  **Completion:**
    *   Once dependencies are installed, a success message is displayed along with instructions on how to `cd` into the new project directory and typically how to start a development server or run the agent.

## Contributing

Contributions are welcome! If you have ideas for new templates, features, or improvements, please feel free to:

1.  Fork the repository.
2.  Create a new branch for your feature or bug fix.
3.  Make your changes.
4.  Submit a pull request.

Please report any bugs or issues by creating an issue on the GitHub repository.

## License

This project is licensed under the Apache License. See the [LICENSE](LICENSE) file for details.
