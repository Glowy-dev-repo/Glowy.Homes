import "server-only";
import { z } from "zod";

/** Values in .env.example are placeholders; treat them as unset so features degrade instead of failing. */
export function isConfigured(value: string | undefined): value is string {
  return !!value && !/replace_me|replace_with/i.test(value) && value !== "re_replace_me";
}

const optional = z
  .string()
  .optional()
  .transform((v) => (isConfigured(v) ? v : undefined));

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: optional,
  AUTH_GOOGLE_ID: optional,
  AUTH_GOOGLE_SECRET: optional,
  RESEND_API_KEY: optional,
  EMAIL_FROM: z.string().default("Glowy.Homes <no-reply@glowy.homes>"),
  /** "log" writes emails to .dev-mail and the console instead of sending. Defaults to log when Resend is not configured. */
  EMAIL_TRANSPORT: z.enum(["resend", "log"]).optional(),
  INNGEST_EVENT_KEY: optional,
  INNGEST_SIGNING_KEY: optional,
  R2_ACCOUNT_ID: optional,
  R2_ACCESS_KEY_ID: optional,
  R2_SECRET_ACCESS_KEY: optional,
  R2_BUCKET: z.string().default("glowy-homes-media"),
  NEXT_PUBLIC_MEDIA_BASE_URL: z.string().default("https://media.glowy.homes"),
  SENTRY_DSN: optional,
  LISTING_FEED: z.enum(["synthetic", "reso", "crea_ddf", "csv"]).default("synthetic"),
  STRIPE_SECRET_KEY: optional,
  ANTHROPIC_API_KEY: optional,
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

export function env(): Env {
  cached ??= EnvSchema.parse(process.env);
  return cached;
}

export function emailTransport(): "resend" | "log" {
  const e = env();
  return e.EMAIL_TRANSPORT ?? (e.RESEND_API_KEY ? "resend" : "log");
}
