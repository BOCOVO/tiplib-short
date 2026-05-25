import { GoogleGenAI } from "@google/genai";
import * as fs from "fs/promises";
import * as path from "path";
import type { IdeaGroup } from "@/app/api/generate/segments/route";

export interface GroupImagePrompt {
  groupIndex: number;
  prompt: string;
}

export async function POST(request: Request) {
  try {
    const { groups, sessionId } = await request.json() as { groups: IdeaGroup[]; sessionId?: string };

    if (!Array.isArray(groups) || groups.length === 0) {
      return Response.json({ error: "groups array is required" }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const prompt = `You are a creative director for motivational short videos (vertical 9:16 format).
For each sentence below, generate a cinematic image generation prompt that visually illustrates it.

Guidelines:
- Directly inspired by the sentence's meaning and emotion
- When people appear, they should be African
- Write each prompt in French

Sentences:
${groups.map((g, i) => `[${i}] ${g.text}`).join("\n\n")}

Return a JSON array of objects with:
- groupIndex: the segment index (integer)
- prompt: the image generation prompt (string)`;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "array",
          items: {
            type: "object",
            properties: {
              groupIndex: { type: "integer" },
              prompt: { type: "string" },
            },
            required: ["groupIndex", "prompt"],
          },
        },
      },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    console.log("[image-prompts] gemini raw:", response.text);

    const result = JSON.parse(response.text ?? "[]") as GroupImagePrompt[];

    if (sessionId) {
      const dir = path.join(process.cwd(), "public", "content", sessionId);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, "image-prompts.json"), JSON.stringify(result));
    }

    return Response.json(result);
  } catch (err) {
    console.error("[image-prompts] error:", err);
    const message = err instanceof Error ? err.message : "Image prompt generation failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
