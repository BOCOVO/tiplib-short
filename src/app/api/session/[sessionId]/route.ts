import * as fs from "fs/promises";
import * as path from "path";
import type { TranscriptionResult } from "@/app/api/generate/timestamps/route";
import type { IdeaGroup } from "@/app/api/generate/segments/route";
import type { GroupImagePrompt } from "@/app/api/generate/image-prompts/route";
import type { GeneratedImage } from "@/app/api/generate/images/route";

export interface SessionData {
  content?: string;
  audioUrl?: string;
  transcription?: TranscriptionResult;
  groups?: IdeaGroup[];
  imagePrompts?: GroupImagePrompt[];
  images?: GeneratedImage[];
}

async function readJson<T>(filePath: string): Promise<T | undefined> {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf-8")) as T;
  } catch {
    return undefined;
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const contentDir = path.join(process.cwd(), "public", "content", sessionId);
  const result: SessionData = {};

  // content.txt
  try {
    result.content = await fs.readFile(path.join(contentDir, "content.txt"), "utf-8");
  } catch {}

  // audio
  try {
    await fs.access(path.join(contentDir, "audio", "voiceover.wav"));
    result.audioUrl = `/content/${sessionId}/audio/voiceover.wav`;
  } catch {}

  // timestamps
  const ts = await readJson<TranscriptionResult>(path.join(contentDir, "timestamps.json"));
  if (ts) result.transcription = ts;

  // segments
  const groups = await readJson<IdeaGroup[]>(path.join(contentDir, "segments.json"));
  if (groups) result.groups = groups;

  // image prompts
  const imagePrompts = await readJson<GroupImagePrompt[]>(path.join(contentDir, "image-prompts.json"));
  if (imagePrompts) result.imagePrompts = imagePrompts;

  // images
  try {
    const imagesDir = path.join(contentDir, "images");
    const files = await fs.readdir(imagesDir);
    const images: GeneratedImage[] = [];
    for (const file of files.sort()) {
      const match = file.match(/^group-(\d+)\.jpg$/);
      if (!match) continue;
      const data = await fs.readFile(path.join(imagesDir, file));
      images.push({ groupIndex: parseInt(match[1]), imageBase64: data.toString("base64"), mimeType: "image/jpeg" });
    }
    if (images.length > 0) result.images = images;
  } catch {}

  return Response.json(result);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const contentDir = path.join(process.cwd(), "public", "content", sessionId);
  try {
    await fs.rm(contentDir, { recursive: true, force: true });
  } catch {}
  return Response.json({ ok: true });
}
