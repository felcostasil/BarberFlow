---
name: readme-validator
description: >-
  Use this skill at the end of each task to verify if the project's README.md needs to be updated with new features, dependencies, or configuration instructions.
---

# README Validator Skill

This skill guides the agent in verifying whether the project's `README.md` requires updates after a task has been completed.

## When to Update the README

You should update [README.md](file:///Users/felipe/Documents/dev/barberShop/README.md) if your changes:
1. Introduce new user-facing features or modify existing user flows.
2. Add new dependencies, libraries, or tools to `package.json`.
3. Require new environment variables in `.env` or configurations.
4. Modify compilation, build, dev, or preview scripts.
5. Add new tests or change how test suites are run.
6. Change the database schema or requirements (Firebase configuration).

## Validation Steps

1. **Review Diff**: Check the files changed during the task.
2. **Verify Configuration**: Check if any setup instructions, scripts, or environmental parameters have changed.
3. **Update Documentation**: Make necessary edits to [README.md](file:///Users/felipe/Documents/dev/barberShop/README.md) to document these changes.
4. **Notify User**: Mention in your final response what updates were made to the README, or if no updates were necessary.
