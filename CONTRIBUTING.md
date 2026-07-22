# Contributing

This is a hackathon project. We accept pull requests but expect short turnarounds. Contributions are most welcome in:

- **Bug reports** (with reproduction steps)
- **Documentation** (typos, clarity)
- **Test coverage** (new test files)
- **Refactoring** (smaller, focused PRs)

## Code of conduct

Be kind. We're all learning.

---

## How to contribute

1. **Fork** the repo.
2. **Branch** from `main`: `git checkout -b feature/your-feature-name`
3. **Code** following the conventions in [DEV.md](./DEV.md#conventions).
4. **Test** locally — see [DEV.md](./DEV.md#tests-run).
5. **Commit** with conventional commit format: `feat:`, `fix:`, `style:`, `chore:`, `docs:`.
6. **Push** your branch.
7. **Open a PR** against `main` with a clear description.

For UI changes, attach screenshots.

---

## Style guide

### Python (`backend/`)

- Pydantic v2 for all data models. No raw dicts in API responses.
- Type hints on every public function (parameters + return type).
- Docstrings on non-obvious functions; comments explain *why*, not *what*.
- No `except: pass` — always catch specific exceptions.
- Keep functions short (under ~80 lines). Split if longer.
- Use `logger.info()` for runtime events, not `print()`.

### TypeScript / React (`frontend/`)

- TypeScript strict mode. No `any` in production code.
- One component per file (small helper components like `KPICard` are OK inline).
- Tailwind utility classes only.
- **No emojis** anywhere — code, comments, UI text.
- INR (₹), not USD ($), for all monetary values in India-context features.
- Numbers in `font-mono`, labels in uppercase tracked sans.
- Cards use the standard elevated pattern: `bg-canvas rounded-xl border border-hairline shadow-sm`.
- Wrap every routed tab in `<ErrorBoundary>`.

### Commit messages

```
feat: short imperative summary (≤ 50 chars)

Optional body explaining why, in 72 cols.
```

---

## What we won't merge

- Anything that adds hardcoded API keys, secrets, or production URLs.
- Anything that breaks the existing build (run `npm run build` and `python -c "import main"` first).
- Anything that adds an emoji.
- Anything that changes the design system without updating [FEATURES.md](./FEATURES.md) and [DEV.md](./DEV.md).

---

## Testing

We don't have CI yet. Before pushing:

```bash
# Backend smoke test
cd backend
.venv310\Scripts\python.exe -c "import main; print('OK')"

# Frontend type check + build
cd frontend
npm run build
```

If both pass, the PR is good to go.

---

## Release process

We don't have versioning. The `main` branch is always deployable. Each merge is tagged by its commit SHA.

For significant milestones, we add a section to [CHANGELOG.md](./CHANGELOG.md).

---

## License

Inherited from the original repo. Check the LICENSE file.

---

## Questions?

Open an issue. Or check the [ARCHITECTURE.md](./ARCHITECTURE.md), [FEATURES.md](./FEATURES.md), [API.md](./API.md), [DEV.md](./DEV.md), [DEPLOYMENT.md](./DEPLOYMENT.md) first.
