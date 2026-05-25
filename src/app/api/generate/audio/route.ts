import { GoogleGenAI } from "@google/genai";
import * as fs from "fs/promises";
import * as path from "path";
import mime from "mime";

export async function POST(request: Request) {
  const { text, sessionId } = (await request.json()) as { text: string; sessionId?: string };

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return Response.json({ error: "text is required" }, { status: 400 });
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const response = await ai.models.generateContentStream({
    model: "gemini-3.1-flash-tts-preview",
    config: {
      temperature: 1,
      responseModalities: ["audio"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: "Aoede" },
        },
      },
    },
    contents: [{ role: "user", parts: [{ text }] }],
  });

  const pcmChunks: Buffer[] = [];
  let mimeType = "";
  let chunkIndex = 0;

  for await (const chunk of response) {
    const part = chunk.candidates?.[0]?.content?.parts?.[0];
    console.log(`[audio] chunk ${chunkIndex++}:`, JSON.stringify({
      hasInlineData: !!part?.inlineData,
      mimeType: part?.inlineData?.mimeType,
      dataLength: part?.inlineData?.data?.length,
      text: part?.text,
    }));
    if (!part?.inlineData) continue;

    if (!mimeType) mimeType = part.inlineData.mimeType ?? "";
    pcmChunks.push(Buffer.from(part.inlineData.data ?? "", "base64"));
  }

  const pcm = Buffer.concat(pcmChunks);
  const ext = mime.getExtension(mimeType);
  const audio = ext ? pcm : buildWav(pcm, mimeType);
  if (!ext) mimeType = "audio/wav";

  console.log(`[audio] mimeType="${mimeType}" ext=${ext} pcmBytes=${pcm.length} audioBytes=${audio.length}`);

  if (sessionId) {
    const contentDir = path.join(process.cwd(), "public", "content", sessionId);
    const audioDir = path.join(contentDir, "audio");
    await fs.mkdir(audioDir, { recursive: true });
    await fs.writeFile(path.join(audioDir, "voiceover.wav"), audio);
    await fs.writeFile(path.join(contentDir, "content.txt"), text);
  }

  return new Response(audio.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": mimeType || "audio/wav",
      "Content-Disposition": 'attachment; filename="voiceover.wav"',
    },
  });
}

function buildWav(pcm: Buffer, mimeType: string): Buffer {
  const options = parseMimeType(mimeType);
  const wavHeader = createWavHeader(pcm.length, options);
  return Buffer.concat([wavHeader, pcm]);
}

interface WavOptions {
  numChannels: number;
  sampleRate: number;
  bitsPerSample: number;
}

function parseMimeType(mimeType: string): WavOptions {
  const [fileType, ...params] = mimeType.split(";").map((s) => s.trim());
  const format = fileType.split("/")[1];

  const options: Partial<WavOptions> = { numChannels: 1 };

  if (format?.toLowerCase().startsWith("l")) {
    const bits = parseInt(format.slice(1), 10);
    if (!isNaN(bits)) options.bitsPerSample = bits;
  }

  for (const param of params) {
    const [key, value] = param.split("=").map((s) => s.trim());
    if (key === "rate") options.sampleRate = parseInt(value, 10);
    if (key === "channels") options.numChannels = parseInt(value, 10);
  }

  return options as WavOptions;
}

function createWavHeader(dataLength: number, opts: WavOptions): Buffer {
  const { numChannels, sampleRate, bitsPerSample } = opts;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const buf = Buffer.alloc(44);

  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataLength, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(numChannels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(bitsPerSample, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataLength, 40);

  return buf;
}
