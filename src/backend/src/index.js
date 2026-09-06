import { app } from './app.js';
import { runMigrations } from './db/migrate.js';
import { bootstrapAdmin } from './db/bootstrapAdmin.js';

const PORT = process.env.PORT || 8000;

async function start() {
  await runMigrations();
  await bootstrapAdmin();
  app.listen(PORT, () => {
    console.log(`teamxtreme backend listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('failed to start server:', err);
  process.exit(1);
});
