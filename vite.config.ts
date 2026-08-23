import { sveltekit } from '@sveltejs/kit/vite';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	resolve: {
		alias: {
			// @ngraveio/bc-ur only needs assert(value, message). Its Node assert
			// dependency references `process`, which does not exist in browsers.
			assert: fileURLToPath(new URL('./src/lib/shims/assert.ts', import.meta.url))
		}
	},
	test: {
		include: ['src/**/*.test.ts'],
		environment: 'node'
	}
});
