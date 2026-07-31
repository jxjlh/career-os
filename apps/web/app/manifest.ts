import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Career OS",
    short_name: "Career OS",
    description: "AI Career Growth Platform",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#2563eb",
    icons: [
      {
        src: "/icons/career-os-appicon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
