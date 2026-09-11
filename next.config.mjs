/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: "/",
        destination: "/room-allocation/index.html",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
