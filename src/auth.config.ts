import type { NextAuthConfig } from "next-auth";
import type { Role } from "@/db/schema/users";

// Edge safe half of the Auth.js config, shared by middleware and the full config in src/lib/auth.ts.
// No database or Node imports here.
export const authConfig = {
  pages: { signIn: "/signin", verifyRequest: "/signin/check-email", error: "/signin" },
  session: { strategy: "jwt" },
  // Hosts are set by Vercel or our own reverse proxy; without this, middleware rejects every host in production.
  trustHost: true,
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.roles = (user as { roles?: Role[] }).roles ?? ["consumer"];
      }
      return token;
    },
    session({ session, token }) {
      if (token.uid) session.user.id = token.uid;
      session.user.roles = token.roles ?? ["consumer"];
      return session;
    },
  },
} satisfies NextAuthConfig;
