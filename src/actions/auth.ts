"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { LOGIN_RATE_LIMITED } from "@/lib/loginThrottle";
import {
  EMAIL_MAX_LENGTH,
  NAME_MAX_LENGTH,
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_LENGTH,
  passwordFits,
} from "@/lib/credentialLimits";

const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Имя должно содержать минимум 2 символа")
    .max(NAME_MAX_LENGTH, `Имя должно быть не длиннее ${NAME_MAX_LENGTH} символов`),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(EMAIL_MAX_LENGTH, "Слишком длинный email")
    .email("Неверный формат email"),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Пароль должен содержать минимум ${PASSWORD_MIN_LENGTH} символов`)
    .refine(
      passwordFits,
      `Пароль слишком длинный: не больше ${PASSWORD_MAX_BYTES} латинских букв или ${PASSWORD_MAX_BYTES / 2} русских`
    ),
});

const WINDOW_MS = 15 * 60 * 1000;
const REGISTER_LIMIT = 5;

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

// Лимит входа — в authorize (src/lib/loginThrottle.ts): форма лишь одна из
// дорог к проверке пароля, адрес входа библиотеки принимает запросы и напрямую.
export async function loginUser(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  try {
    await signIn("credentials", { email, password, redirectTo: "/profile" });
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return (error as { code?: string }).code === LOGIN_RATE_LIMITED
            ? { error: TOO_MANY_ATTEMPTS }
            : { error: "Неверный email или пароль" };
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
