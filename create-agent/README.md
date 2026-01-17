<p align="center">
<a href="https://artinet.io"><img src="https://img.shields.io/badge/website-artinet.io-black" alt="Website"></a>
<a href="https://www.npmjs.com/package/@artinet/create-agent"><img src="https://img.shields.io/npm/v/@artinet/create-agent?color=black" alt="Version"></a>
<a href="https://www.npmjs.com/package/@artinet/create-agent"><img src="https://img.shields.io/npm/dt/@artinet/create-agent?color=black" alt="Downloads"></a>
<a><img src="https://img.shields.io/badge/License-Apache_2.0-black.svg" alt="License"></a>
<a href="https://snyk.io/test/npm/@artinet/create-agent"><img src="https://snyk.io/test/npm/@artinet/create-agent/badge.svg" alt="Known Vulnerabilities"></a>
</p>

<h1 align="center"><em>create agent</em></h1>

A command-line interface (CLI) tool to quickly scaffold starter agent projects from a predefined set of templates. [`create-agent`](https://www.npmjs.com/package/@artinet/create-agent) streamlines the initial setup process, allowing you to get your new agent project up and running in minutes.

From the [artinet](https://artinet.io/).

## Prerequisites

- [Node.js](https://nodejs.org/) (version 22.x or higher recommended, check `package.json` for specific engine requirements)
- `npm` (comes with Node.js)

## Installation & Usage

The easiest way to use `create-agent` is with `npx`, which ensures you're always using the latest version:

```bash
npx @artinet/create-agent@latest
```

This command will initiate an interactive session:

1.  **Select a Template:** You'll be prompted to choose from the available agent templates.
    ```bash
    ? Select template › - Use arrow-keys. Return to submit.
    ❯   basic
        coder (requires OPENAI_API_KEY)
        orchestrator (requires OPENAI_API_KEY)
    ```
2.  **Enter Project Name:** You'll be asked to provide a name for your new project. This name will be used for the directory and in the project's `package.json`.
    ```bash
    ? Enter your project name › my-new-agent
    ```

## Available Templates

`create-agent` currently offers the following templates:

- **`basic`**: A minimal agent template, perfect for understanding the core structure or for simple agent tasks.
- **`coder`**: A template pre-configured for developing agents with a focus on code generation, understanding, or manipulation tasks.
- **`orchestrator`**: A template designed for building orchestrator agents that can manage and coordinate multiple other agents or tasks.

## Contributing

Contributions are welcome! If you have ideas for new templates, features, or improvements, please feel free to:

1.  Fork the repository.
2.  Create a new branch for your feature or bug fix.
3.  Make your changes.
4.  Submit a pull request.

Please report any bugs or issues by creating an issue on the GitHub repository.

## License

This project is licensed under the Apache License. See the [LICENSE](LICENSE) file for details.
