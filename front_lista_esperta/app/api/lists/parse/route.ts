import { GeminiUnavailableError, readListPhoto } from "@/lib/ai/gemini";
import { splitLines } from "@/lib/list/parse";

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

/** Foto (multipart, campo "image") ou texto (JSON { text }) → linhas da lista. */
export async function POST(request: Request) {
  const type = request.headers.get("content-type") ?? "";

  if (type.includes("application/json")) {
    const { text } = (await request.json().catch(() => ({}))) as { text?: unknown };
    if (typeof text !== "string") return Response.json({ error: "Envie { text: string }." }, { status: 400 });
    return Response.json({ lines: splitLines(text), source: "text" });
  }

  const form = await request.formData().catch(() => null);
  const image = form?.get("image");
  if (!(image instanceof Blob)) return Response.json({ error: "Envie a foto no campo image." }, { status: 400 });
  if (image.size > MAX_IMAGE_BYTES)
    return Response.json({ error: "A foto passou de 6 MB. Tente uma foto menor." }, { status: 413 });

  try {
    return Response.json({ lines: await readListPhoto(image), source: "gemini" });
  } catch (e) {
    const status = e instanceof GeminiUnavailableError ? 503 : 502;
    return Response.json({ error: e instanceof Error ? e.message : "Não foi possível ler a foto." }, { status });
  }
}
