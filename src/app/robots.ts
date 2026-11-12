import type { MetadataRoute } from "next";

/** Closed beta: nothing is indexed. Open the sign-in and public pages once the site launches publicly. */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", disallow: "/" }] };
}
