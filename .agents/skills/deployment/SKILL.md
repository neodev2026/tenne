---
name: deployment
description: Enforces deployment trust boundaries and GitHub Pages static hosting workflows.
---

# Deployment Skill

## Intent
Safeguard public production deployments, ensuring releases occur strictly from human-reviewed `main`.

## Guidelines
1. Production CD triggers exclusively on push to `main` via `.github/workflows/deploy.yml`.
2. Pull requests and feature branches must never trigger production deployments.
3. Validate that build artifacts in `dist/` contain relative asset paths for GitHub Pages compatibility.
