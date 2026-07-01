/** @type {import('next').NextConfig} */
const isGitHubPages = process.env.GITHUB_PAGES === "true";

const nextConfig = {
  output: "export",
  outputFileTracingRoot: process.cwd(),
  trailingSlash: true,
  basePath: isGitHubPages ? "/slotviewer" : "",
  assetPrefix: isGitHubPages ? "/slotviewer/" : "",
  images: {
    unoptimized: true
  },
  env: {
    NEXT_PUBLIC_BASE_PATH: isGitHubPages ? "/slotviewer" : ""
  }
};

export default nextConfig;
