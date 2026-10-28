import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import appCss from "../styles.css?url";

const SITE = "https://www.baucua5play.online/";
const APP_NAME = "Bầu Cua Tôm Cá | Bau Cua";
const APP_DESC =
  "Bau cua, bau cua tom ca. Chơi bầu cua tôm cá trên bàn gỗ, tự bấm hoặc tự xóc. Bau cua 2027, bau cua 2028, bau cua 2029, bau cua 2030. Trò chơi mô phỏng, không đặt cược tiền thật.";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover, interactive-widget=resizes-content" },
      { title: APP_NAME },
      { name: "description", content: APP_DESC },
      { name: "keywords", content: "bau cua, bau cua tom ca, bau cua 2027, bau cua 2028, bau cua 2029, bau cua 2030, bầu cua, bầu cua tôm cá" },
      { name: "robots", content: "index, follow" },
      { property: "og:url", content: SITE },
      { property: "og:title", content: APP_NAME },
      { property: "og:description", content: APP_DESC },
      { property: "og:type", content: "website" },
      { name: "theme-color", content: "#4c0c11" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
    ],
    links: [
      { rel: "canonical", href: SITE },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "sitemap", type: "application/xml", href: "/sitemap.xml" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,500;0,700;0,800;1,800&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
