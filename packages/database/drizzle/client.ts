import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const connectionString =
	process.env.DATABASE_URL ??
	"postgresql://postgres:postgres@127.0.0.1:5432/ulivo";

export const pool = new Pool({
	connectionString,
	max: 10,
});

if (process.env.VERCEL) {
	attachDatabasePool(pool);
}

export const db = drizzle({ client: pool, schema });
