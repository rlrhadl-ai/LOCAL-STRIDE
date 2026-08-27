/** @type {import('next').NextConfig} */
// API_ORIGIN 이 설정되면 /api/* 와 /socket.io/* 요청을 Vercel 서버가 대신 EC2로 넘긴다(rewrite).
// 브라우저는 Vercel(https)하고만 통신하므로 API 쪽에 도메인·인증서가 없어도 된다.
// Vercel 환경변수: API_ORIGIN=http://<EC2 탄력적 IP>  NEXT_PUBLIC_API_URL=/
const apiOrigin = (process.env.API_ORIGIN || '').replace(/\/$/, '');

const nextConfig = {
  reactStrictMode: true,
  images: { remotePatterns: [{ protocol: 'http', hostname: 'tong.visitkorea.or.kr' }, { protocol: 'https', hostname: 'tong.visitkorea.or.kr' }] },
  async rewrites() {
    if (!apiOrigin) return [];
    return [
      { source: '/api/:path*', destination: `${apiOrigin}/api/:path*` },
      { source: '/uploads/:path*', destination: `${apiOrigin}/uploads/:path*` },
      { source: '/socket.io/:path*', destination: `${apiOrigin}/socket.io/:path*` },
    ];
  },
};

export default nextConfig;
