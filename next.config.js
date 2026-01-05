/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    SCREET_KEY_JWT: process.env.SCREET_KEY_JWT,
  },
}

module.exports = nextConfig
