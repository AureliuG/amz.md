// NP_EXPORT=1 builds the web-hosting package (static files in a subfolder + PHP API, see scripts/pachet-gazduire.sh).
const hosting = process.env.NP_EXPORT === "1";

/** @type {import('next').NextConfig} */
const nextConfig = hosting
  ? {
      reactStrictMode: true,
      output: "export",
      basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
      trailingSlash: true,
      images: { unoptimized: true },
    }
  : {
      reactStrictMode: true,
      // Self-contained server bundle for the Docker image (see Dockerfile / docs/DEPLOY.md).
      output: "standalone",
    };
export default nextConfig;
