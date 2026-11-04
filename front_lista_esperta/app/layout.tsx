import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

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
  icons: {
    icon: [{ url: "/icon_lista_esperta.ico", sizes: "256x256", type: "image/x-icon" }],
    shortcut: "/icon_lista_esperta.ico",
    apple: "/icon_lista_esperta.ico",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f8fe" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1430" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${barlow.variable} ${barlowCondensed.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
