"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

const registerSchema = z.object({
  name: z.string().trim().min(2, "Имя должно содержать минимум 2 символа"),
  email: z.string().trim().toLowerCase().email("Неверный формат email"),
  password: z.string().min(6, "Пароль должен содержать минимум 6 символов"),
});

const WINDOW_MS = 15 * 60 * 1000;
const REGISTER_LIMIT = 5;
const LOGIN_LIMIT = 10;

const TOO_MANY_ATTEMPTS = "Слишком много попыток. Попробуйте позже.";

export async function registerUser(formData: FormData) {
  try {
    const ip = await getClientIp();
    if (!rateLimit(`register:${ip}`, { limit: REGISTER_LIMIT, windowMs: WINDOW_MS }).allowed) {
      return { error: TOO_MANY_ATTEMPTS };
    }

    const parsed = registerSchema.safeParse({
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0].message };
    }

    const { name, email, password } = parsed.data;
    const hashedPassword = await bcrypt.hash(password, 12);

    try {
      await prisma.user.create({
        data: { name, email, password: hashedPassword },
      });
    } catch (error) {
      // P2002 = unique constraint on email. Reporting "already registered"
      // would turn the form into an account-enumeration oracle, so a taken
      // email gets exactly the same answer as a fresh one.
      if (isPrismaError(error, "P2002")) {
        return { success: true };
      }
      throw error;
    }

    return { success: true };
  } catch (error) {
    console.error("registerUser failed", error);
    return { error: "Произошла ошибка при регистрации" };
  }
}

export async function loginUser(formData: FormData) {
  const ip = await getClientIp();
  if (!rateLimit(`login:${ip}`, { limit: LOGIN_LIMIT, windowMs: WINDOW_MS }).allowed) {
    return { error: TOO_MANY_ATTEMPTS };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  try {
    await signIn("credentials", { email, password, redirectTo: "/profile" });
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { error: "Неверный email или пароль" };
        default:
          return { error: "Что-то пошло не так" };
      }
    }
    // A successful sign-in ends with the NEXT_REDIRECT control-flow error;
    // swallowing it here would leave the user on the login page.
    throw error;
  }
}

function isPrismaError(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === code
  );
}
