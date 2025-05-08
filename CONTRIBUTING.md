# Contributing to Siemens S7 MQTT

Thank you for considering contributing to Siemens S7 MQTT! This document outlines the process for contributing to the project.

## Code of Conduct

Please be respectful and considerate when participating in this project. We aim to foster an inclusive and welcoming environment.

## Getting Started

1. Fork the repository on GitHub
2. Clone your forked repository: `git clone https://github.com/YOUR-USERNAME/siemens-s7-mqtt.git`
3. Add the upstream repository: `git remote add upstream https://github.com/jonasclaes/siemens-s7-mqtt.git`
4. Create a new branch for your feature/fix: `git checkout -b feature/your-feature-name`

## Development Environment

1. Install dependencies with `pnpm install`
2. Use `pnpm run dev` for development with auto-reload
3. Make sure to write tests for new functionality
4. Ensure all tests pass with `pnpm test` before submitting a pull request

## Pull Request Process

1. Update the README.md or documentation with details of changes if applicable
2. Ensure that your code passes all tests and follows the project's coding style
3. Update the schema if you've added new configuration options
4. Submit a pull request to the `main` branch of the upstream repository
5. Your PR will be reviewed by the maintainers

## Coding Standards

- Use TypeScript features appropriately
- Document public methods and complex logic
- Follow the existing code style and patterns
- Write tests for your code

## Testing

- All new features should have corresponding tests
- Run `pnpm test` to run the test suite
- Run `pnpm run test:coverage` to check the code coverage

## Git Commit Messages

- Use clear and descriptive commit messages
- Structure them with a brief summary on the first line
- Optionally, provide a more detailed explanation after the summary

Example:
```
Add support for dimmable lights

This adds the ability to control dimmable lights through the S7 PLC.
The implementation includes both status reading and command writing
for brightness values.
```

## Reporting Bugs

When reporting bugs, please include:

1. A clear and descriptive title
2. Steps to reproduce the issue
3. Expected behavior and what you observed instead
4. Log outputs if available
5. Your environment details (OS, Node.js version, etc.)

## Feature Requests

Feature requests are welcome! When submitting a feature request:

1. Describe the use case and problem you're trying to solve
2. Explain why this feature would be useful to others
3. Provide examples of how the feature would work

## License

By contributing to this project, you agree that your contributions will be licensed under the project's [Apache License 2.0](LICENSE).

Thank you for contributing!
