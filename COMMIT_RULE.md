# Commit Rules

## When to commit

**Never commit on your own.** Only create a commit when the user explicitly asks you to. Finishing a task is not a request to commit. Never push unless asked.

## Format

```text
[Type] scope: short description

[Changes]:

  * Change description
  * Change description

[Todo]:

  * Remaining task
```

- `[Changes]:` is required, with at least one bullet.
- `[Todo]:` is optional. Include it only for real remaining work; never invent items.
- Bullets use exactly two spaces, then `*`, then a space. No `-`, no unindented `*`.
- Header is `[Type] scope: description`. Scope is short and lowercase (e.g. `auth`, `cart`, `ui`).
- Do not use conventional-commit syntax (`feat:`, `fix:`).

## Types

`Feat` · `Fix` · `Refactor` · `Docs` · `Style` · `Test` · `Chore` · `Perf` · `Build` · `Ci`

## Before committing

1. Review the actual diff.
2. Describe only changes that were really made.
3. Keep one commit focused on related changes; leave unrelated changes out.
4. No generic messages like "update files".

## Example

```text
[Feat] cart: added shopping cart

[Changes]:

  * Added cart drawer
  * Added quantity controls
  * Added cart total calculation

[Todo]:

  * Persist cart between sessions
```
