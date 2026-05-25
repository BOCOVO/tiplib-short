import Groq from "groq-sdk";
import * as fs from "fs/promises";
import * as path from "path";

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

export interface TranscriptionResult {
  text: string;
  words: WordTimestamp[];
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const audio = formData.get("audio");
  const sessionId = formData.get("sessionId") as string | null;

  if (!audio || !(audio instanceof Blob)) {
    return Response.json({ error: "audio file is required" }, { status: 400 });
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const file = new File([audio], "voiceover.wav", { type: audio.type || "audio/wav" });

  const transcription = await groq.audio.transcriptions.create({
    file,
    model: "whisper-large-v3",
    temperature: 0,
    response_format: "verbose_json",
    timestamp_granularities: ["word"],
  });

  const verbose = transcription as unknown as {
    text: string;
    words?: WordTimestamp[];
  };

  const result: TranscriptionResult = {
    text: verbose.text,
    words: verbose.words ?? [],
  };

  if (sessionId) {
    const dir = path.join(process.cwd(), "public", "content", sessionId);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "timestamps.json"), JSON.stringify(result));
  }

  return Response.json(result);
}
