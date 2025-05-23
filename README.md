# Module LTD URL Shortener

[![CI/CD](https://github.com/Tomer20/module-ltd-url-shortener/actions/workflows/ci.yml/badge.svg)](https://github.com/Tomer20/module-ltd-url-shortener/actions/workflows/ci.yml)
[![Version](https://img.shields.io/badge/version-0.0.0-blue.svg)](./package.json)
[![Code Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen.svg)](./coverage/index.html)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node Version](https://img.shields.io/badge/node-%3E%3D16-green.svg)](./package.json)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare%20Workers-deployed-orange.svg)](https://developers.cloudflare.com/workers/)

A lightweight, secure URL shortener service built on Cloudflare Workers, allowing you to create and manage shortened URLs with minimal overhead and enterprise-level security.

## Features

- 🚀 Serverless architecture using Cloudflare Workers
- 🔑 Secure token-based authentication with timing attack protection
- 🔒 Secret management for sensitive credentials and IDs
- ⚡️ Fast redirects through Cloudflare's global network
- 🔄 KV storage for efficient link management
- 🛡️ Comprehensive security headers (CSP, HSTS, X-Frame-Options)
- 🔍 Strict URL validation to prevent malicious redirects
- 📊 Request metadata tracking for audit purposes
- 🧪 Testing with Vitest
- 🚢 CI/CD with automated versioning and releases

## Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (Cloudflare Workers CLI)
- A Cloudflare account

## Usage

### Create a shortened URL

To create a new shortened URL, send a POST request with your authentication token:

```bash
curl -X POST "https://module-ltd-url-shortener.yourdomain.workers.dev" \
  -H "Content-Type: application/json" \
  -H "X-Auth-Token: your-secret-auth-token" \
  -d '{"target": "https://example.com"}'
```

Response:

```json
{
  "short": "https://module-ltd-url-shortener.yourdomain.workers.dev/Ab3Xc7D9"
}
```

The short URL ID is cryptographically secure and 8 characters long

### Access a shortened URL

Simply open the shortened URL in a browser or use:

```bash
curl -L "https://module-ltd-url-shortener.yourdomain.workers.dev/Ab3Xc7D9"
```

## Read the Docs

1. [Setup](./docs/setup.md)
2. [Development Workflow](./docs/development.md)
3. [Implementation Details](./docs/implementation-details.md)
4. [Security](./docs/security.md)
5. [Troubleshooting](./docs/troubleshooting.md)
6. [CI/CD Integration](./docs/ci-cd.md)
7. [To Do](./docs/todo.md)

## License

[MIT](./LICENSE)
