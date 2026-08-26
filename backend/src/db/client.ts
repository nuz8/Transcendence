import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";

dotenv.config({ path: "../.env" });

const {
	POSTGRES_USER,
	POSTGRES_PASSWORD,
	POSTGRES_PORT,
	POSTGRES_DB,
} = process.env;

if (!POSTGRES_USER || !POSTGRES_PASSWORD  || !POSTGRES_PORT || !POSTGRES_DB) {
	throw new Error("Incomplete PostgreSQL environment configuration");
}

const databaseUrl = 
	`postgresql://${encodeURIComponent(POSTGRES_USER)}:` +
	`${encodeURIComponent(POSTGRES_PASSWORD)}@localhost:` +
	`${POSTGRES_PORT}/${POSTGRES_DB}`;

export const db = drizzle(databaseUrl!);