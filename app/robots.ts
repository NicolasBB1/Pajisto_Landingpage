import type { MetadataRoute } from "next";
import { ALLOW_INDEXING } from "@/lib/public-config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: ALLOW_INDEXING ? { userAgent: "*", allow: "/", disallow: "/api/" } : { userAgent: "*", disallow: "/" },
  };
}
