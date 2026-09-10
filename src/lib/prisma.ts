import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createClient>;
};

function createClient() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prismaPg = new PrismaPg(pool);
  
  const client = new PrismaClient({ 
    adapter: prismaPg,
    omit: { user: { password: true } }
  });
  
  return client;
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
