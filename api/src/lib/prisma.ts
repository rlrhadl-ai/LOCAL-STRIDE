import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// engineType="client": Rust 엔진 없이 pg 드라이버 어댑터로 연결. 싱글턴으로 커넥션 누수 방지 (SES 때 EC2 과부하 교훈)
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
function create() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, max: Number(process.env.PG_POOL_MAX || 10) });
  return new PrismaClient({ adapter, log: process.env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error'] });
}
export const prisma = globalForPrisma.prisma ?? create();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
