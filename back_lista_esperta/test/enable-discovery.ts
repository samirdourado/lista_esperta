// Imported first by stores.e2e-spec.ts: ConfigModule reads the environment
// when AppModule is imported, so the flag must be set before that import.
// Vitest isolates modules per test file, so other suites keep it off.
process.env.DISCOVERY_ENABLED = 'true';
