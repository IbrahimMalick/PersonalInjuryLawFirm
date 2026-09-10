import type { MetadataRoute } from "next";

function base(): string {
  return (process.env.PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export default function robots(): MetadataRoute.Robots {
  const b = base();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // App internals, tenant screens, per-firm intake forms, and the demo.
      disallow: [
        "/api/",
        "/operator",
        "/settings",
        "/lead/",
        "/archive",
        "/intake/",
        "/demo",
        "/gap",
        "/setup",
        "/verify",
        "/reset",
        "/forgot",
      ],
    },
    sitemap: `${b}/sitemap.xml`,
  };
}
