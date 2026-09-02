import dotenv from "dotenv"
import { defineConfig } from "drizzle-kit"

dotenv.config({ path: "../.env" });

const {
	POSTGRES_USER,
	POSTGRES_PASSWORD,
	POSTGRES_PORT,
	POSTGRES_NAME,
} = process.env;

if (!POSTGRES_USER || !POSTGRES_PASSWORD  || !POSTGRES_PORT || !POSTGRES_NAME) {
	throw new Error("Incomplete PostgreSQL environment configuration");
}

const databaseUrl = 
	`postgresql://${encodeURIComponent(POSTGRES_USER)}:` +
	`${encodeURIComponent(POSTGRES_PASSWORD)}@localhost:` +
	`${POSTGRES_PORT}/${POSTGRES_NAME}`;

export default defineConfig({
	schema: "./src/db/schema.ts",
	out: "./drizzle",
	dialect: "postgresql",
	dbCredentials: {
		url:databaseUrl,
	},
});