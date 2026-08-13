import path from 'node:path';
import { fileURLToPath } from 'node:url';

try {
  process.loadEnvFile(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env'));
} catch {
  // no .env — optional features (aircraft photos) are simply skipped
}
