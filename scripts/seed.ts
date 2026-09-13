/**
 * Deterministic database seed CLI script.
 *
 * Run with: npm run seed
 */
import "dotenv/config";
import { pool } from "../src/db";
import { seedInitialData } from "../src/db/seed";

async function main() {
  console.log("Starting BASIS deterministic seed...");
  await seedInitialData();
  console.log("BASIS deterministic seed completed successfully.");
  process.exit(0);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (pool && typeof pool.end === "function") {
      await pool.end().catch(() => {});
    }
  });
