# CI/CD Integration

This project includes a fully configured CI/CD pipeline using GitHub Actions. The workflow is defined in `.github/workflows/ci.yml` and provides:

1. **Continuous Integration**:
   - Runs on every push and pull request to the main branch
   - Executes the complete test suite in CI mode
   - Ensures code quality and functionality before deployment

2. **Continuous Deployment**:
   - Automatically deploys to Cloudflare Workers when changes are pushed to the main branch
   - Only deploys after all tests have passed successfully
   - Uses secure secrets management for all sensitive information

3. **Automatic Versioning and Release**:
   - Automatically bumps the patch version number in `package.json` after successful deployment
   - Creates a new GitHub release with the updated version number
   - Includes commit history link in release notes for change tracking
   - Follows semantic versioning (`0.0.X` for now, controlled via `package.json`)

## Required Repository Secrets

For the CI/CD pipeline to function correctly, add these secrets to your GitHub repository:
- `CF_API_TOKEN`: Your Cloudflare API token
- `KV_LINKS_PRODUCTION_ID`: Your KV namespace ID
- `AUTH_TOKEN`: Your authentication token
- `ALLOWED_ORIGINS`: Your domain(s) that are allowed to access the API (e.g., "your-domain.com")
- `GITHUB_TOKEN`: Automatically provided by GitHub, used for creating releases
