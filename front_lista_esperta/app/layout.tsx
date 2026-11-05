import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import { InlineScript } from "@/components/InlineScript";
import { SkipLink } from "@/components/layout/SkipLink";
import { OfflineBanner } from "@/components/pwa/OfflineBanner";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import { THEME_BOOT_SCRIPT } from "@/components/theme/theme";
import "./globals.css";
import { Providers } from "./providers";

const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  title: { default: "Lista Esperta", template: "%s | Lista Esperta" },
  description: "Descubra onde sua lista de compras inteira sai mais barata perto de você, contando o deslocamento.",
  applicationName: "Lista Esperta",
  appleWebApp: { capable: true, title: "Lista Esperta", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icon_lista_esperta.ico", sizes: "256x256", type: "image/x-icon" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: { url: "/icons/apple-touch-icon.png", sizes: "180x180" },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#111d3d" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${barlow.variable} ${barlowCondensed.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <InlineScript html={THEME_BOOT_SCRIPT} />
      </head>
      <body className="flex min-h-full flex-col">
        <SkipLink />
        <OfflineBanner />
        <Providers>{children}</Providers>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
