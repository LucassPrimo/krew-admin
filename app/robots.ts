import type { MetadataRoute } from 'next'

/** Nada aqui é para ser indexado. Nunca. */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', disallow: '/' } }
}
