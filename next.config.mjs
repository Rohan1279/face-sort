const nextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  turbopack: {
    resolveAlias: { "@vladmandic/human": "./node_modules/@vladmandic/human/dist/human.esm.js" },
  },
};

export default nextConfig;
