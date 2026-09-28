import type { NextRequest } from "next/server";
import { handlers } from "@/auth";
import { isSessionRead, withoutSessionCookies } from "@/lib/sessionRefresh";

export const { POST } = handlers;

/** Чтение сессии не ставит её cookie — иначе оно может отменить выход (#104). */
export async function GET(request: NextRequest) {
  const response = await handlers.GET(request);
  return isSessionRead(request) ? withoutSessionCookies(response) : response;
}
