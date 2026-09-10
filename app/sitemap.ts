import type { MetadataRoute } from "next";

// Only the public marketing/legal pages. The app (inbox, settings, operator,
// per-firm intake forms) is deliberately kept out of search.

function base(): string {
  return (process.env.PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export default function sitemap(): MetadataRoute.Sitemap {
  const b = base();
  const now = new Date();
  return [
    { url: `${b}/`, lastModified: now, changeFrequency: "monthly", priority: 1 },
    { url: `${b}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${b}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
