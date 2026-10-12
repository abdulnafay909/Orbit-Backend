import fs from "fs";
import path from "path";
import { pool } from "./database";

export async function ensureDatabaseSchema(): Promise<void> {
  const schemaPath = path.join(process.cwd(), "src", "db", "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf8");
  await pool.query(schema);
}
