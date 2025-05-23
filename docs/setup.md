# Setup

## Starting from Scratch

If you're creating a new project from scratch:

1. Install Wrangler CLI:

```bash
npm install -g wrangler
```

2. Initialize a new project:

```bash
wrangler init module-ltd-url-shortener
```

3. Follow Wrangler's interactive prompts.

## Cloning this Repository

If you've cloned or forked this repository:

1. Install dependencies:

```bash
npm install
```

2. Install Wrangler CLI if you haven't already:

```bash
npm install -g wrangler
```

3. Use the setup script to configure all required secrets and environments:

```bash
# Make the script executable
chmod +x ./scripts/setup-secrets.sh

# For Cloudflare secrets only
./scripts/setup-secrets.sh

# For both Cloudflare and GitHub secrets
./scripts/setup-secrets.sh --github
```

The setup script will:
- Create KV namespaces for production and development
- Generate a secure authentication token
- Set up allowed origins for CORS
- Configure all necessary secrets for Cloudflare Workers
- Optionally set up GitHub repository secrets for CI/CD
- Create a local `.dev.vars` file for development

4. (Alternative) Manual setup if you prefer not to use the script:

```bash
# Create KV namespaces
wrangler kv namespace create LINKS
wrangler kv namespace create LINKS_PREVIEW

# Generate authentication token
TOKEN=$(openssl rand -base64 32)
echo $TOKEN | wrangler secret put AUTH_TOKEN

# Set KV namespace ID as secret
KV_ID="your-namespace-id-from-output-above"
echo $KV_ID | wrangler secret put KV_LINKS_PRODUCTION_ID

# Set allowed origins
echo "your-domain.com,*.your-domain.com" | wrangler secret put ALLOWED_ORIGINS

# Create local development variables
cat > .dev.vars << EOF
# Local development environment variables
ALLOWED_ORIGINS=dev.example.com,localhost:8787
AUTH_TOKEN=dev_local_token_for_testing_only
EOF
```

5. Update the KV namespace in `wrangler.jsonc`:

```bash
# Replace the preview_id in wrangler.jsonc with your preview namespace ID
PREVIEW_ID="your-preview-namespace-id-from-step-3"
sed -i.bak "s/\"preview_id\": \"[^\"]*\"/\"preview_id\": \"$PREVIEW_ID\"/" wrangler.jsonc && rm wrangler.jsonc.bak
```
