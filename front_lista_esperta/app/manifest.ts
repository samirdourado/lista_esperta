import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lista Esperta",
    short_name: "Lista Esperta",
    description: "Onde sua lista de compras inteira sai mais barata perto de você.",
    lang: "pt-BR",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f8fe",
    theme_color: "#1a5fe0",
    icons: [
      { src: "/icon_lista_esperta.ico", sizes: "256x256", type: "image/x-icon", purpose: "any" },
      { src: "/logo_lista_esperta.webp", sizes: "999x903", type: "image/webp", purpose: "any" },
    ],
  };
}
