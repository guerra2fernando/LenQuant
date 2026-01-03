import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/extension", "/platform", "/privacy", "/terms", "/login"],
        disallow: [
          "/api/",
          "/portfolio",
          "/analytics",
          "/settings/",
          "/trading/",
          "/insights/",
          "/assistant/",
          "/evolution/",
          "/forecasts/",
          "/journal/",
          "/knowledge/",
          "/models/",
          "/reports/",
          "/risk/",
          "/strategies",
          "/terminal",
          "/setup-complete",
          "/get-started",
        ],
      },
    ],
    sitemap: "https://lenquant.com/sitemap.xml",
  };
}
