"use client";

import { signOut } from "next-auth/react";
import Button from "@/components/ui/Button";

/**
 * Выход тем же путём, что в шапке: запрос выхода и полная перезагрузка.
 * Серверное действие с мягким переходом оставляло шапку с «Профиль / Выйти»
 * до перезагрузки, а другие вкладки о выходе не узнавали (#104).
 */
export default function SignOutButton() {
  return (
    <Button type="button" variant="danger" onClick={() => signOut({ redirectTo: "/" })}>
      Выйти
    </Button>
  );
}
