/** @type {import('next').NextConfig} */
const nextConfig = {
  // static site: all face processing runs in the browser, so no server is needed
  output: "export",
  trailingSlash: true, // emits legacy/index.html, so any static host serves /legacy/
  images: { unoptimized: true },
  turbopack: {
    // Human's package exports pick its Node build (needs @tensorflow/tfjs-node) during prerender; always use the browser bundle
    resolveAlias: { "@vladmandic/human": "./node_modules/@vladmandic/human/dist/human.esm.js" },
  },
};

export default nextConfig;
