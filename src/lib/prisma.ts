import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createClient>;
};

function createClient() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prismaPg = new PrismaPg(pool);
  
  const client = new PrismaClient({ adapter: prismaPg });
  
  // Extension to remove password from default selects
  return client.$extends({
    query: {
      user: {
        async $allOperations({ operation, args, query }) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const typedArgs = args as any;
          if (
            ['findUnique', 'findFirst', 'findMany'].includes(operation) &&
            !typedArgs.select &&
            !typedArgs.include
          ) {
            typedArgs.select = {
              id: true,
              name: true,
              email: true,
              emailVerified: true,
              image: true,
              createdAt: true,
              // password is intentionally omitted
            };
          }
          return query(typedArgs);
        },
      },
    },
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
