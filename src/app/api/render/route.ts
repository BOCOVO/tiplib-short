import * as fs from "fs/promises";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { buildTimeline } from "@/lib/buildTimeline";
import type { IdeaGroup } from "@/app/api/generate/segments/route";
import type { GeneratedImage } from "@/app/api/generate/images/route";
import type { WordTimestamp } from "@/app/api/generate/timestamps/route";

const execAsync = promisify(exec);

export const maxDuration = 600;

export async function POST(request: Request) {
  try {
    const { sessionId, audioBase64, groups, images, words } = await request.json() as {
      sessionId: string;
      audioBase64: string;
      groups: IdeaGroup[];
      images: GeneratedImage[];
      words: WordTimestamp[];
    };

    if (!sessionId || !audioBase64 || !groups?.length || !images?.length) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    const contentDir = path.join(process.cwd(), "public", "content", sessionId);
    const audioDir = path.join(contentDir, "audio");
    const imagesDir = path.join(contentDir, "images");

    await fs.mkdir(audioDir, { recursive: true });
    await fs.mkdir(imagesDir, { recursive: true });

    // Save audio
    const audioPath = path.join(audioDir, "voiceover.wav");
    await fs.writeFile(audioPath, Buffer.from(audioBase64, "base64"));

    // Save images
    const imageMap: Record<number, string> = {};
    for (const img of images) {
      const filename = `group-${img.groupIndex}.jpg`;
      await fs.writeFile(
        path.join(imagesDir, filename),
        Buffer.from(img.imageBase64, "base64"),
      );
      imageMap[img.groupIndex] = `content/${sessionId}/images/${filename}`;
    }

    // Total audio duration from word timestamps
    const totalDurationMs = (words.at(-1)?.end ?? groups.at(-1)?.end ?? 0) * 1000;

    // Build segments for timeline
    const segments = groups.map((group, i) => ({
      text: group.text,
      imageUrl: imageMap[i] ?? imageMap[0],
      startMs: group.start * 1000,
      durationMs: (group.end - group.start) * 1000,
    }));

    const timeline = buildTimeline(
      segments,
      `content/${sessionId}/audio/voiceover.wav`,
      totalDurationMs,
      words,
    );

    await fs.writeFile(
      path.join(contentDir, "timeline.json"),
      JSON.stringify(timeline, null, 2),
    );

    // Render
    const videosDir = path.join(process.cwd(), "public", "videos");
    await fs.mkdir(videosDir, { recursive: true });
    const outputFile = path.join(videosDir, `${sessionId}.mp4`);

    console.log(`[render] starting render for ${sessionId}`);

    const { stdout, stderr } = await execAsync(
      `pnpm exec remotion render --bundle-cache=false --concurrency=1 ${sessionId} "${outputFile}"`,
      { cwd: process.cwd(), timeout: 540_000 },
    );

    console.log("[render] stdout:", stdout);
    if (stderr) console.warn("[render] stderr:", stderr);

    return Response.json({ videoUrl: `/api/video/${sessionId}` });
  } catch (err) {
    console.error("[render] error:", err);
    const message = err instanceof Error ? err.message : "Render failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
