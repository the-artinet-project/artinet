# Contributing to agent-def

Thank you for your interest in contributing to `agent-def`! This library aims to be a community-driven standard for defining collaborative AI agents, and we welcome contributions from everyone.

## How You Can Contribute

### Enhance the Standard

The agent definition schema is designed to evolve with the community's needs:

- **Propose new fields or capabilities** - If you've identified missing functionality, open an issue describing your use case
- **Refine existing schemas** - Suggest improvements to make definitions clearer, more flexible, or easier to use
- **Add validation rules** - Help make the schemas more robust with better validation and error messages
- **Document patterns** - Share examples of how you're using agent definitions in your projects

### Improve Documentation

- Add practical examples and use cases
- Clarify confusing sections
- Fix typos and improve clarity
- Translate documentation to other languages

### Code Contributions

- Fix bugs
- Improve test coverage
- Add new features (after discussing in an issue first)
- Optimize schema validation
- Enhance TypeScript types

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
    ```bash
    git clone https://github.com/your-username/artinet.git
    cd artinet/agent-def
    ```
3. **Install dependencies**:
    ```bash
    npm install
    ```
4. **Create a branch** for your changes:
    ```bash
    git checkout -b feature/your-feature-name
    ```

## Development Workflow

```bash
# Build the library
npm run build

# Generate JSON Schema
npm run generate:schema

# Clean build artifacts
npm run clean
```

## Making Changes

### Schema Changes

When modifying schemas in `src/definition.ts`:

1. Ensure backwards compatibility when possible
2. Update JSDoc comments with clear descriptions and examples
3. Run `npm run generate:schema` to update the JSON Schema
4. Add or update tests to cover your changes
5. Update the README if the changes affect the public API

### Testing

- Write tests for new functionality
- Ensure all tests pass before submitting a PR
- Include both success and failure cases

### Code Style

- Follow the existing code style
- Run `npm run lint` and fix any errors
- Use meaningful variable and function names
- Add comments for complex logic

## Submitting Changes

1. **Commit your changes** with clear, descriptive commit messages:
    ```bash
    git commit -m "Add support for custom metadata fields"
    ```
2. **Push to your fork**:
    ```bash
    git push origin feature/your-feature-name
    ```
3. **Open a Pull Request** on GitHub with:
    - Clear description of what you've changed and why
    - Reference to any related issues
    - Examples of how to use new features

## Proposing Major Changes

For significant changes to the standard:

1. **Open an issue first** to discuss your proposal
2. Provide use cases and examples
3. Consider backwards compatibility
4. Allow time for community feedback
5. Be open to iterating on the design

## Community Guidelines

- Be respectful and constructive
- Welcome newcomers and help them get started
- Focus on what's best for the agent-def standard and community
- Follow the [Code of Conduct](CODE_OF_CONDUCT.md)

## Questions?

- Open an issue for questions about contributing
- Check existing issues and PRs to see if your topic has been discussed
- Join discussions on [artinet](https://github.com/the-artinet-project)

## Recognition

All contributors will be recognized in the project. Thank you for helping build the future of collaborative AI agent standards!
