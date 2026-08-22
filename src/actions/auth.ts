"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { signIn } from "@/auth";
import { AuthError } from "next-auth";

const registerSchema = z.object({
  name: z.string().min(2, "Имя должно содержать минимум 2 символа"),
  email: z.string().email("Неверный формат email"),
  password: z.string().min(6, "Пароль должен содержать минимум 6 символов"),
});

export async function registerUser(formData: FormData) {
  try {
    const data = Object.fromEntries(formData.entries());
    const parsed = registerSchema.safeParse(data);

    if (!parsed.success) {
      return { error: parsed.error.issues[0].message };
    }

    const { name, email, password } = parsed.data;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return { error: "Пользователь с таким email уже существует" };
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    });

    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "Произошла ошибка при регистрации" };
  }
}

export async function loginUser(formData: FormData) {
  try {
    await signIn("credentials", Object.fromEntries(formData.entries()));
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
