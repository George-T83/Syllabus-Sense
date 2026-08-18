/** @type {import('next').NextConfig} */
const nextConfig = {
  // firebase-admin's token verification pulls in jwks-rsa, which imports
  // the ESM-only `jose` package via require() - webpack's bundling of that
  // chain for serverless functions breaks with ERR_REQUIRE_ESM at runtime.
  // Marking it external skips bundling and loads it natively from
  // node_modules instead, where Node's own module resolution handles the
  // ESM/CJS interop correctly.
  experimental: {
    serverComponentsExternalPackages: ['firebase-admin'],
  },
};

export default nextConfig;
