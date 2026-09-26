import "server-only";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { authConfig } from "@/auth.config";
import { db } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";
import { sendEmail } from "@/lib/email";
import { magicLinkEmail } from "@/lib/email/templates/magic-link";
import { env } from "@/lib/env";

const e = env();

const providers: Provider[] = [
  Resend({
    // The provider requires a key even when the log transport handles delivery.
    apiKey: e.RESEND_API_KEY ?? "log-transport",
    from: e.EMAIL_FROM,
    async sendVerificationRequest({ identifier, url }) {
      await sendEmail({ to: identifier, link: url, ...magicLinkEmail(url) });
    },
  }),
];

if (e.AUTH_GOOGLE_ID && e.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: e.AUTH_GOOGLE_ID,
      clientSecret: e.AUTH_GOOGLE_SECRET,
      // Google verifies email ownership, so linking to an existing magic link account is safe.
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

export const googleEnabled = providers.length > 1;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  secret: e.AUTH_SECRET,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers,
  callbacks: {
    ...authConfig.callbacks,
    async jwt(params) {
      const token = await authConfig.callbacks.jwt(params);
      // Roles can change after sign in (pro signup, admin grant); refresh them on session update.
      if (params.trigger === "update" && token.uid) {
        const row = await db.query.users.findFirst({ where: eq(users.id, token.uid), columns: { roles: true } });
        if (row) token.roles = row.roles;
      }
      return token;
    },
  },
  events: {
    async signIn({ user }) {
      if (user.id) await db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, user.id));
    },
  },
});
