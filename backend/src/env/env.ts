import { z } from 'zod';

export const envSchema = z.object({
  JWT_SECRET: z.string().min(32),
  TOKEN_EXPIRATION_TIME: z.string().optional(),
  APP_PORT: z.number().optional(),
});

export function validateEnv(env: Record<string, unknown>) {
  try {
    return envSchema.parse(env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.issues
        .map((issue) => `${issue.path.join('.')} - ${issue.message}`)
        .join(', ');

      error.message = `Invalid environment variables: [${message}]`;
    }

    throw error;
  }
}

export type Env = z.infer<typeof envSchema>;
