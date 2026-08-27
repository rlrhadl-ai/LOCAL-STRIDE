import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// engineType="client": Rust 엔진 없이 pg 드라이버 어댑터로 연결. 싱글턴으로 커넥션 누수 방지 (SES 때 EC2 과부하 교훈)
// DATABASE_URL 예)
//   로컬:  postgresql://localstride:localstride@localhost:5432/localstride
//   RDS :  postgresql://postgres:<비번>@<엔드포인트>:5432/localstride?sslmode=require&sslaccept=accept_invalid_certs
//   RDS 는 PostgreSQL 15+ 부터 SSL 강제(rds.force_ssl=1). sslmode/sslaccept 는 Prisma CLI(migrate)용 파라미터라
//   pg 드라이버에는 넘기지 않고, 대신 ssl 옵션으로 변환한다. RDS 인증서는 Amazon 자체 CA 라 검증은 생략(VPC 내부 통신).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function pgConfig() {
  const url = new URL(process.env.DATABASE_URL || 'postgresql://localstride:localstride@localhost:5432/localstride');
  const sslmode = url.searchParams.get('sslmode');
  ['sslmode', 'sslaccept', 'sslcert', 'sslidentity', 'schema', 'connection_limit', 'pool_timeout', 'connect_timeout'].forEach((k) => url.searchParams.delete(k));
  return { connectionString: url.toString(), max: Number(process.env.PG_POOL_MAX || 10), ssl: sslmode && sslmode !== 'disable' ? { rejectUnauthorized: false } : undefined };
}
function create() {
  const adapter = new PrismaPg(pgConfig());
  return new PrismaClient({ adapter, log: process.env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error'] });
}
export const prisma = globalForPrisma.prisma ?? create();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
