import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lista Esperta",
    short_name: "Lista Esperta",
    description: "Onde sua lista de compras inteira sai mais barata perto de você.",
    lang: "pt-BR",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f6f1",
    theme_color: "#f4f6f1",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
