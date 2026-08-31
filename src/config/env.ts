import { z } from 'zod';
import dotenv from 'dotenv';
dotenv.config();

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1).default('postgresql://postgres:postgres@localhost:5433/llm_usage_tracker'),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_FREE: z.string().optional(),
  STRIPE_PRICE_PRO: z.string().optional(),
  STRIPE_PRODUCT_FREE: z.string().optional(),
  STRIPE_PRODUCT_PRO: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export const env: Env = EnvSchema.parse(process.env);
