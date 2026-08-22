"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { headers } from "next/headers";

const registerSchema = z.object({
  name: z.string().min(2, "Имя должно содержать минимум 2 символа"),
  email: z.string().email("Неверный формат email").trim().toLowerCase(),
  password: z.string().min(6, "Пароль должен содержать минимум 6 символов"),
});

// Simple in-memory rate limiter (resets on restart)
const rateLimit = new Map<string, { count: number; expiresAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(ip: string | undefined): boolean {
  if (!ip) return true; // Can't limit without IP
  
  const now = Date.now();
  const record = rateLimit.get(ip);
  
  if (!record || record.expiresAt < now) {
    rateLimit.set(ip, { count: 1, expiresAt: now + WINDOW_MS });
    return true;
  }
  
  if (record.count >= MAX_ATTEMPTS) {
    return false;
  }
  
  record.count += 1;
  return true;
}

export async function registerUser(formData: FormData) {
  try {
    const headersList = await headers();
    const ip = headersList.get("x-forwarded-for") || "unknown";
    if (!checkRateLimit(ip)) {
      return { error: "Слишком много попыток. Попробуйте позже." };
    }

    const data = Object.fromEntries(formData.entries());
    const parsed = registerSchema.safeParse(data);

    if (!parsed.success) {
      return { error: parsed.error.issues[0].message };
    }

    const { name, email, password } = parsed.data;

    const hashedPassword = await bcrypt.hash(password, 12);

    try {
      await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
        },
      });
    } catch (e) {
      if (typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2002") {
        // Hide enumeration
        return { success: true };
      }
      throw e;
    }

    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "Произошла ошибка при регистрации" };
  }
}

export async function loginUser(formData: FormData) {
  try {
    const headersList = await headers();
    const ip = headersList.get("x-forwarded-for") || "unknown";
    if (!checkRateLimit(ip)) {
      return { error: "Слишком много попыток. Попробуйте позже." };
    }

    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
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
    throw error; // Rethrow to allow Next.js redirect to work
  }
}
