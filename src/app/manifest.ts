import type { MetadataRoute } from "next";

/** Lets drivers add the Șofer page to their home screen like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nobil Prest · Șofer",
    short_name: "Nobil Prest",
    start_url: "/sofer",
    display: "standalone",
    background_color: "#eef2fb",
    theme_color: "#1f3fb3",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
