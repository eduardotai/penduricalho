# Versioning

This project uses [Semantic Versioning](https://semver.org/) in `package.json` and **git tags** for recoverable milestones.

## Release a new version

1. Bump `version` in `package.json` (and add a section to `CHANGELOG.md`).
2. Commit the release.
3. Tag and push:

```bash
git tag -a v1.0.0 -m "v1.0.0: MVP"
git push origin HEAD
git push origin v1.0.0
```

## Roll back locally

Checkout a tag or commit:

```bash
git fetch --tags
git checkout v1.0.0
```

To return to latest work on a branch:

```bash
git checkout feat/idle-runs
```

## Roll back on Vercel

1. Open the project on [vercel.com](https://vercel.com) → **Deployments**.
2. Find the deployment you want (production or preview).
3. Use **⋯ → Promote to Production** (or redeploy from CLI at that git ref).

From CLI after checking out a tag:

```bash
git checkout v1.0.0
npx vercel --prod
git checkout -
```

## List versions

```bash
git tag -l "v*"
git log --oneline --decorate -10
```
