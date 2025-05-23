import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
	test: {
		poolOptions: {
			workers: {
				wrangler: { configPath: './wrangler.jsonc' },
				miniflare: {
					// Miniflare specific options
					bindings: {
						AUTH_TOKEN: 'test-auth-token',
						ALLOWED_ORIGINS: '*'
					},
					kvNamespaces: ['LINKS']
				}
			},
		},
		mockReset: true,
		coverage: {
			provider: 'istanbul', // Use istanbul instead of v8
			reporter: ['text', 'json', 'html'],
			exclude: ['node_modules/', 'test/', 'coverage/'],
		}
	},
});
