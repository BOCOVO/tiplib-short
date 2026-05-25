import { GoogleGenAI, PersonGeneration } from "@google/genai";
import * as fs from "fs/promises";
import * as path from "path";
import type { GroupImagePrompt } from "@/app/api/generate/image-prompts/route";

export interface GeneratedImage {
  groupIndex: number;
  imageBase64: string;
  mimeType: string;
}

export async function POST(request: Request) {
  try {
    const { imagePrompts, sessionId } = await request.json() as {
      imagePrompts: GroupImagePrompt[];
      sessionId: string;
    };

    if (!Array.isArray(imagePrompts) || imagePrompts.length === 0) {
      return Response.json({ error: "imagePrompts array is required" }, { status: 400 });
    }
    if (!sessionId) {
      return Response.json({ error: "sessionId is required" }, { status: 400 });
    }

    const imagesDir = path.join(process.cwd(), "public", "content", sessionId, "images");
    await fs.mkdir(imagesDir, { recursive: true });

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const results: GeneratedImage[] = [];
    let apiCallIndex = 0;

    for (const { groupIndex, prompt } of imagePrompts) {
      const filePath = path.join(imagesDir, `group-${groupIndex}.jpg`);

      // Use cached image if it exists
      try {
        const existing = await fs.readFile(filePath);
        console.log(`[images] group ${groupIndex}: using cached`);
        results.push({ groupIndex, imageBase64: existing.toString("base64"), mimeType: "image/jpeg" });
        continue;
      } catch {
        // not cached, generate it
      }

      if (apiCallIndex > 0) await new Promise((r) => setTimeout(r, 3000));
      apiCallIndex++;

      const response = await ai.models.generateImages({
        model: "models/imagen-4.0-generate-001",
        prompt,
        config: {
          numberOfImages: 1,
          personGeneration: PersonGeneration.ALLOW_ADULT,
          aspectRatio: "9:16",
        },
      });

      console.log(`[images] generated group ${groupIndex} (call ${apiCallIndex}/${imagePrompts.length})`);
      const imageBytes = response?.generatedImages?.[0]?.image?.imageBytes;
      if (!imageBytes) {
        console.warn(`[images] no image returned for group ${groupIndex}`);
        continue;
      }

      await fs.writeFile(filePath, Buffer.from(imageBytes, "base64"));
      results.push({ groupIndex, imageBase64: imageBytes, mimeType: "image/jpeg" });
    }

    return Response.json(results);
  } catch (err) {
    console.error("[images] error:", err);
    const message = err instanceof Error ? err.message : "Image generation failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
