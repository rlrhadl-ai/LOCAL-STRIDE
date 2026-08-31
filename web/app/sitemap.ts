import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ['', '/courses', '/spots', '/programs', '/benefits', '/crews', '/mates', '/events', '/host', '/rankings', '/privacy', '/terms'];
  return paths.map((path) => ({ url: `https://localstride.kr${path}`, lastModified: new Date(), changeFrequency: path === '' ? 'daily' : 'weekly', priority: path === '' ? 1 : 0.7 }));
}
