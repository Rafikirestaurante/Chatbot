// Compatibility entry point. Tests use fake credentials and mocked provider responses.
import { spawnSync } from 'node:child_process';
const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', 'server/gemini.test.ts', 'server/firebase.test.ts'], { stdio: 'inherit' });
process.exit(result.status ?? 1);
