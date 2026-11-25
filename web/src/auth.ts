import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { verify } from "@node-rs/argon2";
import { z } from "zod";
import { db } from "@/lib/db";
import { limited } from "@/lib/ratelimit";

const creds = z.object({ email: z.email(), password: z.string().min(1).max(200) });

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 14 },
  pages: { signIn: "/login" },
  providers: [
    ...(process.env.AUTH_GOOGLE_ID ? [Google] : []),
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = creds.safeParse(raw);
        if (!parsed.success) return null;
        const email = parsed.data.email.toLowerCase();
        if (await limited(`login:${email}`, 8, 15 * 60 * 1000)) return null;
        const user = await db.user.findUnique({ where: { email } });
        if (!user?.passwordHash || user.disabled) return null;
        const ok = await verify(user.passwordHash, parsed.data.password);
        return ok ? { id: user.id, email: user.email, name: user.name, image: user.image } : null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token }) {
      if (token.sub) {
        const u = await db.user.findUnique({ where: { id: token.sub }, select: { role: true, disabled: true } });
        if (!u || u.disabled) return null;
        token.role = u.role;
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      session.user.role = (token.role as "CLIENT" | "ADMIN") ?? "CLIENT";
      return session;
    },
  },
});
