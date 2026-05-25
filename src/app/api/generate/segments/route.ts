import * as fs from "fs/promises";
import * as path from "path";
import type { WordTimestamp } from "@/app/api/generate/timestamps/route";

export interface Sentence {
  text: string;
  start: number;
  end: number;
}

export interface IdeaGroup {
  sentences: Sentence[];
  text: string;
  start: number;
  end: number;
  emotionalIntention: string;
}

function reconstructSentences(words: WordTimestamp[]): Sentence[] {
  const sentences: Sentence[] = [];
  let current: WordTimestamp[] = [];

  for (const word of words) {
    current.push(word);
    if (/[.!?]+$/.test(word.word.trim())) {
      sentences.push({
        text: current.map((w) => w.word).join(" "),
        start: current[0].start,
        end: current[current.length - 1].end,
      });
      current = [];
    }
  }

  if (current.length > 0) {
    sentences.push({
      text: current.map((w) => w.word).join(" "),
      start: current[0].start,
      end: current[current.length - 1].end,
    });
  }

  return sentences;
}

export async function POST(request: Request) {
  try {
    const { words, sessionId } = await request.json() as { words: WordTimestamp[]; sessionId?: string };

    if (!Array.isArray(words) || words.length === 0) {
      return Response.json({ error: "words array is required" }, { status: 400 });
    }

    const sentences = reconstructSentences(words);

    const groups: IdeaGroup[] = sentences.map((s) => ({
      sentences: [s],
      text: s.text,
      start: s.start,
      end: s.end,
      emotionalIntention: "",
    }));

    if (sessionId) {
      const dir = path.join(process.cwd(), "public", "content", sessionId);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, "segments.json"), JSON.stringify(groups));
    }

    return Response.json(groups);
  } catch (err) {
    console.error("[segments] error:", err);
    const message = err instanceof Error ? err.message : "Segmentation failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
