import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";

dotenv.config({ path: "../.env" });

const {
	POSTGRES_USER,
	POSTGRES_PASSWORD,
	POSTGRES_HOST,
	POSTGRES_PORT,
	POSTGRES_NAME,
} = process.env;

if (!POSTGRES_HOST || !POSTGRES_USER || !POSTGRES_PASSWORD || !POSTGRES_PORT || !POSTGRES_NAME) {
	throw new Error("Incomplete PostgreSQL environment configuration");
}

const databaseUrl = 
	`postgresql://${encodeURIComponent(POSTGRES_USER)}:` +
	`${encodeURIComponent(POSTGRES_PASSWORD)}@${POSTGRES_HOST}:` +
	`${POSTGRES_PORT}/${POSTGRES_NAME}`;

export const db = drizzle(databaseUrl!);
