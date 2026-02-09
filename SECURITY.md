# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in nevr-env, please report it responsibly.

**DO NOT open a public GitHub issue for security vulnerabilities.**

Instead, please email us at **nevr-env@proton.me** with:

1. A description of the vulnerability
2. Steps to reproduce
3. Potential impact
4. Suggested fix (if you have one)

We will acknowledge receipt within 48 hours and aim to provide a fix within 7 days for critical issues.

## Security Features

nevr-env takes security seriously. The vault feature uses:

- **AES-256-GCM** authenticated encryption
- **PBKDF2** key derivation (600,000 iterations, SHA-512)
- **HMAC-SHA256** integrity verification with timing-safe comparison
- Random 32-byte salt + 16-byte IV per encryption
- `NEVR_ENV_KEY` is never stored in the vault file

## Best Practices

- Never commit `.env` files to git
- Use `nevr-env vault` for sharing secrets with your team
- Rotate secrets regularly (use `nevr-env rotate` to track)
- Use `nevr-env scan` in CI to catch accidentally committed secrets
