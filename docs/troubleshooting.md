# Troubleshooting

## Common Issues

1. **Authentication Error (401 Unauthorized)**
   - Make sure you're using the correct `AUTH_TOKEN` with your requests
   - For local development, use the token from `.dev.vars`
   - For production, use the token generated with `openssl rand -base64 32`

2. **KV Namespace Error**
   - Verify your KV namespaces were created correctly: `wrangler kv namespace list`
   - Ensure the `preview_id` in `wrangler.jsonc` matches your `LINKS_PREVIEW` namespace ID
   - Check that `KV_LINKS_PRODUCTION_ID` secret is set: `wrangler secret list`

3. **"Server configuration error" response**
   - This means the `AUTH_TOKEN` environment variable isn't set
   - For production: `wrangler secret put AUTH_TOKEN`
   - For development: check your `.dev.vars` file

4. **Deploy Errors**
   - Run `wrangler whoami` to verify you're logged in to the correct account
   - Confirm your account has the necessary permissions

