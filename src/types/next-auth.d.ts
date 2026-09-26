import type { DefaultSession } from "next-auth";
import type { Role } from "@/db/schema/users";

declare module "next-auth" {
  interface Session {
    user: { id: string; roles: Role[] } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    uid?: string;
    roles?: Role[];
  }
}
