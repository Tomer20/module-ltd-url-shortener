# Development Workflow

## Local Development

Start a local development server that uses the preview KV namespace and local variables:

```bash
npm run dev
```

This starts a local server at http://localhost:8787 with:
- The preview KV namespace specified in `preview_id`
- Local environment variables from `.dev.vars` 
- A simpler development token for authentication

You can create a shortened URL locally using:

```bash
curl -X POST "http://localhost:8787" \
  -H "Content-Type: application/json" \
  -H "X-Auth-Token: dev_local_token_for_testing_only" \
  -d '{"target": "https://example.com"}'
```

## Testing

This project includes a comprehensive test suite that verifies all aspects of the URL shortener:

- Authentication and authorization
- URL validation and creation
- URL redirection
- Error handling
- Security headers

The project provides several testing commands:

```bash
# Development mode (watches for changes)
npm test

# CI mode (runs once, exits with status code)
npm run test:ci

# Generate test coverage report
npm run test:coverage
```

The test suite is organized into logical sections and uses mocks for the KV store to ensure reliable testing without requiring actual Cloudflare infrastructure. The `test:ci` command is particularly useful for automated pipelines and continuous integration environments.

## Deployment

Deploy to Cloudflare Workers with production secrets:

```bash
npm run deploy
```

This uses:
- The production KV namespace ID from the `KV_LINKS_PRODUCTION_ID` secret
- The secure `AUTH_TOKEN` from secrets
- Production environment variables

Your URL shortener will be available at: `https://module-ltd-url-shortener.yourdomain.workers.dev`
