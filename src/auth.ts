import NextAuth, { CredentialsSignin } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./lib/prisma";
import bcrypt from "bcryptjs";
import { getClientIp } from "./lib/rate-limit";
import {
  LOGIN_RATE_LIMITED,
  loginBlocked,
  loginFailed,
  loginSucceeded,
} from "./lib/loginThrottle";

// Dummy hash for constant-time comparison when user is not found (cost=12)
const DUMMY_HASH = "$2b$12$aY4dNGXWaW7uw3o95lhgXO2qUtU.11Z60yJjotDdFqiHDjCKMth9y";

/** Отказ по лимиту: код доходит до формы и до адреса перенаправления. */
class TooManyAttempts extends CredentialsSignin {
  code = LOGIN_RATE_LIMITED;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adapter: PrismaAdapter(prisma as any),
  session: { strategy: "jwt" },
  providers: [
    Google,
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = (credentials.email as string).trim().toLowerCase();
        const password = credentials.password as string;

        // Лимит — здесь, а не в форме: адрес входа библиотеки принимает
        // запросы и напрямую. Заблокированная попытка до базы и bcrypt не идёт.
        const ip = await getClientIp();
        if (loginBlocked(ip, email)) throw new TooManyAttempts();

        // Explicitly request password to avoid Prisma extension omission if configured
        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            name: true,
            email: true,
            password: true,
            image: true,
          }
        });

        // Constant time response
        if (!user || !user.password) {
          await bcrypt.compare(password, DUMMY_HASH);
          loginFailed(ip, email);
          return null;
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
          loginFailed(ip, email);
          return null;
        }
        loginSucceeded(ip, email);

        // Do not return password to JWT
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (token.sub && session.user) {
        session.user.id = token.sub;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
  },
});
