# Security Policy

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting form under the repository's **Security** tab. Do not open a public issue for suspected vulnerabilities, leaked credentials, or private data.

Include the affected file or workflow, reproduction steps, impact, and any suggested mitigation. Reports will be acknowledged as soon as practical.

## Credential policy

- Never commit `.env` files, API keys, tokens, private keys, cookies, or exported browser sessions.
- Keep credentials in local environment variables or an external secret manager.
- Use `.env.example` only for empty variable names and non-sensitive defaults.
- If a credential is exposed, revoke or rotate it first, then remove it from Git history.

## Media and personal data

Only publish media that you created or have explicit rights to redistribute. Do not commit private likeness assets, client material, voice references, local runtime logs, or generated outputs containing personal data.
