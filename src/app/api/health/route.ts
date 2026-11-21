import { prisma } from "@/lib/prisma";
import { healthResponse } from "@/lib/health";

/**
 * GET /api/health — жив ли сервер и отвечает ли база (#120). На него смотрят
 * HEALTHCHECK образа, скрипт выкладки и workflow Uptime. Под лимиты частоты
 * не подведён: проверка не должна блокировать сама себя.
 */
export async function GET(): Promise<Response> {
  return healthResponse(() => prisma.$queryRaw`SELECT 1`, 2000);
}
