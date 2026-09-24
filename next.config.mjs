/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/a/**",
      }
    ]
  },
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        /*
          Камера разрешена своему сайту и только ему: ею снимают кубик на
          /solve. Разрешение — на весь сайт, а не на один маршрут: политика
          действует на документ, и человек, пришедший на /solve по ссылке из
          меню, остаётся в документе той страницы, с которой пришёл. Чужим
          встроенным фреймам камера по-прежнему закрыта, а спросить человека
          браузер всё равно спросит.
        */
        { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
      ],
    }];
  },
};

export default nextConfig;
