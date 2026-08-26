import dotenv from "dotenv"
import { defineConfig } from "drizzle-kit"

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

export default defineConfig({
	schema: "./src/db/schema.ts",
	out: "./drizzle",
	dialect: "postgresql",
	dbCredentials: {
		url:databaseUrl,
	},
});