"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@heroui/react/button";
import { Label } from "@heroui/react/label";
import { TextArea } from "@heroui/react/textarea";
import type { TranscriptionResult, WordTimestamp } from "@/app/api/generate/timestamps/route";
import type { IdeaGroup } from "@/app/api/generate/segments/route";
import type { GroupImagePrompt } from "@/app/api/generate/image-prompts/route";
import type { GeneratedImage } from "@/app/api/generate/images/route";
import type { SessionData } from "@/app/api/session/[sessionId]/route";

const MAX_CHARS = 2000;

const STEPS = ["Your post", "Voiceover", "Segments", "Visuals", "Images", "Render"];

async function contentToSessionId(text: string): Promise<string> {
  const data = new TextEncoder().encode(text.trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 24);
  return `session-${hex}`;
}

export default function PostForm() {
  const [step, setStep] = useState(0);
  const [content, setContent] = useState("");
  const [loadingMsg, setLoadingMsg] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [, setTranscription] = useState<TranscriptionResult | null>(null);
  const [words, setWords] = useState<WordTimestamp[] | null>(null);
  const [groups, setGroups] = useState<IdeaGroup[] | null>(null);
  const [imagePrompts, setImagePrompts] = useState<GroupImagePrompt[] | null>(null);
  const [images, setImages] = useState<GeneratedImage[] | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resumeData, setResumeData] = useState<SessionData | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const audioUrlRef = useRef<string | null>(null);
  const audioBlobRef = useRef<Blob | null>(null);
  const sessionIdRef = useRef<string>("");

  const charCount = content.length;
  const isOverLimit = charCount > MAX_CHARS;
  const isEmpty = content.trim().length === 0;
  const isLoading = !!loadingMsg;

  // When content changes, compute its hash and check for an existing session
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!content.trim()) {
        sessionIdRef.current = "";
        setResumeData(null);
        return;
      }
      const sid = await contentToSessionId(content);
      sessionIdRef.current = sid;
      try {
        const res = await fetch(`/api/session/${sid}`);
        if (!res.ok) { setResumeData(null); return; }
        const data: SessionData = await res.json();
        setResumeData(data.audioUrl || data.transcription || data.images ? data : null);
      } catch {
        setResumeData(null);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [content]);

  async function extractError(res: Response): Promise<string> {
    try {
      const body = await res.json();
      return body?.error ?? `HTTP ${res.status}`;
    } catch {
      return `HTTP ${res.status}`;
    }
  }

  const restoreFromSession = useCallback(async (data: SessionData) => {
    setResumeData(null);

    if (data.audioUrl) {
      audioUrlRef.current = data.audioUrl;
      setAudioUrl(data.audioUrl);
      // audioBlobRef will be fetched lazily in render()
    }
    if (data.transcription) {
      setTranscription(data.transcription);
      setWords(data.transcription.words);
    }
    if (data.groups) setGroups(data.groups);
    if (data.imagePrompts) setImagePrompts(data.imagePrompts);
    if (data.images) setImages(data.images);

    if (data.images && data.images.length > 0) setStep(4);
    else if (data.imagePrompts) setStep(3);
    else if (data.groups) setStep(2);
    else setStep(1);
  }, []);

  const startNewSession = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (sid) {
      try { await fetch(`/api/session/${sid}`, { method: "DELETE" }); } catch {}
    }
    setResumeData(null);
    setAudioUrl(null);
    setWords(null);
    setGroups(null);
    setImagePrompts(null);
    setImages(null);
    setVideoUrl(null);
    setError(null);
    audioUrlRef.current = null;
    audioBlobRef.current = null;
  }, []);

  const generate = useCallback(async () => {
    const sid = sessionIdRef.current;
    setLoadingMsg("Generating audio…");
    setError(null);
    setTranscription(null);
    setWords(null);
    setGroups(null);
    setImagePrompts(null);
    setImages(null);
    setVideoUrl(null);
    audioBlobRef.current = null;
    if (audioUrlRef.current && audioUrlRef.current.startsWith("blob:")) {
      URL.revokeObjectURL(audioUrlRef.current);
    }
    audioUrlRef.current = null;
    setAudioUrl(null);

    try {
      // 1 — Audio
      const audioRes = await fetch("/api/generate/audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: content, sessionId: sid }),
      });
      if (!audioRes.ok) throw new Error(await extractError(audioRes));
      const blob = await audioRes.blob();
      audioBlobRef.current = blob;
      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;
      setAudioUrl(url);
      setTimeout(() => audioRef.current?.play(), 0);

      // 2 — Timestamps
      setLoadingMsg("Generating timestamps…");
      const form = new FormData();
      form.append("audio", blob, "voiceover.wav");
      form.append("sessionId", sid);
      const tsRes = await fetch("/api/generate/timestamps", { method: "POST", body: form });
      if (!tsRes.ok) throw new Error(await extractError(tsRes));
      const tsResult: TranscriptionResult = await tsRes.json();
      setTranscription(tsResult);
      setWords(tsResult.words);

      // 3 — Segments
      setLoadingMsg("Segmenting text…");
      const segRes = await fetch("/api/generate/segments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ words: tsResult.words, sessionId: sid }),
      });
      if (!segRes.ok) throw new Error(await extractError(segRes));
      const segResult: IdeaGroup[] = await segRes.json();
      setGroups(segResult);

      // 4 — Image prompts
      setLoadingMsg("Generating image prompts…");
      const ipRes = await fetch("/api/generate/image-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groups: segResult, sessionId: sid }),
      });
      if (!ipRes.ok) throw new Error(await extractError(ipRes));
      const ipResult: GroupImagePrompt[] = await ipRes.json();
      setImagePrompts(ipResult);

      // 5 — Images
      setLoadingMsg("Generating images…");
      const imgRes = await fetch("/api/generate/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagePrompts: ipResult, sessionId: sid }),
      });
      if (!imgRes.ok) throw new Error(await extractError(imgRes));
      const imgResult: GeneratedImage[] = await imgRes.json();
      setImages(imgResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoadingMsg(null);
    }
  }, [content]);

  const retryImages = useCallback(async () => {
    if (!imagePrompts) return;
    setLoadingMsg("Generating missing images…");
    setError(null);
    try {
      const imgRes = await fetch("/api/generate/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagePrompts, sessionId: sessionIdRef.current }),
      });
      if (!imgRes.ok) throw new Error(await extractError(imgRes));
      setImages(await imgRes.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image retry failed");
    } finally {
      setLoadingMsg(null);
    }
  }, [imagePrompts]);

  const render = useCallback(async () => {
    if (!groups || !images || !words) return;
    setLoadingMsg("Rendering video…");
    setError(null);

    try {
      // Fetch audio blob lazily (resume case: only have a static URL)
      if (!audioBlobRef.current && audioUrlRef.current) {
        setLoadingMsg("Loading audio…");
        const res = await fetch(audioUrlRef.current);
        audioBlobRef.current = await res.blob();
      }
      if (!audioBlobRef.current) throw new Error("Audio not available");

      setLoadingMsg("Rendering video…");
      const sessionId = sessionIdRef.current;
      const audioBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(audioBlobRef.current!);
      });

      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, audioBase64, groups, images, words }),
      });
      if (!res.ok) throw new Error(await extractError(res));
      const { videoUrl } = await res.json();
      setVideoUrl(videoUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Render failed");
    } finally {
      setLoadingMsg(null);
    }
  }, [groups, images, words]);

  const missingImages = imagePrompts && images && images.length < imagePrompts.length;

  return (
    <div className="min-h-screen p-4 flex flex-col justify-start sm:justify-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-2xl mx-auto flex flex-col gap-6 sm:gap-8">

        {/* Step indicator */}
        <div className="flex items-center gap-0">
          {STEPS.map((label, i) => (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold border-2 transition-colors ${
                  i < step ? "bg-current border-current text-white"
                  : i === step ? "border-current text-current"
                  : "border-gray-300 text-gray-400"
                }`}>
                  {i < step ? (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z" />
                    </svg>
                  ) : i + 1}
                </div>
                <span className={`hidden sm:block text-xs font-medium ${i <= step ? "text-current" : "text-gray-400"}`}>
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 sm:mb-5 mx-1 sm:mx-2 transition-colors ${i < step ? "bg-current" : "bg-gray-200"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 0 — Post content */}
        {step === 0 && (
          <div className="flex flex-col gap-4">
            {/* Resume banner */}
            {resumeData && (
              <div className="flex flex-col gap-2 p-3 rounded-lg border border-gray-200 bg-gray-50">
                <p className="text-sm text-gray-700 font-medium">You have a previous session.</p>
                <div className="flex gap-2">
                  <Button fullWidth onPress={() => restoreFromSession(resumeData)}>Resume</Button>
                  <Button variant="outline" fullWidth onPress={startNewSession}>Start over</Button>
                </div>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <Label htmlFor="post-content">Post content</Label>
              <TextArea
                id="post-content"
                placeholder="Paste your motivational post here…"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={10}
                fullWidth
              />
              <div className="flex justify-end">
                <span className={`text-xs tabular-nums ${isOverLimit ? "text-red-500" : "text-gray-400"}`}>
                  {charCount} / {MAX_CHARS}
                </span>
              </div>
            </div>
            <Button isDisabled={isEmpty || isOverLimit} fullWidth onPress={() => { setStep(1); generate(); }}>
              Next
            </Button>
          </div>
        )}

        {/* Step 1 — Voiceover */}
        {step === 1 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              {loadingMsg && <LoadingRow label={loadingMsg} />}
              {error && <ErrorBlock message={error} onRetry={generate} />}
              {audioUrl && (
                <div className="flex flex-col gap-1">
                  <Label>Voiceover preview</Label>
                  <audio ref={audioRef} src={audioUrl} controls className="w-full" />
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="shrink-0" onPress={() => setStep(0)}>Back</Button>
              <Button fullWidth isDisabled={isLoading || !groups || !!error} onPress={() => setStep(2)}>
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Step 2 — Segments */}
        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              {groups && groups.map((group, i) => (
                <div key={i} className="flex flex-col gap-1 p-3 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Sentence {i + 1}
                    </span>
                    <span className="text-xs text-gray-400 tabular-nums">
                      {group.start.toFixed(2)}s – {group.end.toFixed(2)}s
                    </span>
                  </div>
                  <p className="text-sm">{group.text}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="shrink-0" onPress={() => setStep(1)}>Back</Button>
              <Button fullWidth isDisabled={!imagePrompts || !!error} onPress={() => setStep(3)}>
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Step 3 — Visuals */}
        {step === 3 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              {imagePrompts && groups && imagePrompts.map((ip) => {
                const group = groups[ip.groupIndex];
                return (
                  <div key={ip.groupIndex} className="flex flex-col gap-2 p-3 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Sentence {ip.groupIndex + 1}
                      </span>
                      {group && (
                        <span className="text-xs text-gray-400 tabular-nums">
                          {group.start.toFixed(2)}s – {group.end.toFixed(2)}s
                        </span>
                      )}
                    </div>
                    <p className="text-sm">{ip.prompt}</p>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="shrink-0" onPress={() => setStep(2)}>Back</Button>
              <Button fullWidth isDisabled={!images || !!error} onPress={() => setStep(4)}>Next</Button>
            </div>
          </div>
        )}

        {/* Step 4 — Images */}
        {step === 4 && (
          <div className="flex flex-col gap-4">
            {loadingMsg && <LoadingRow label={loadingMsg} />}
            {error && <ErrorBlock message={error} onRetry={retryImages} />}
            {missingImages && !isLoading && !error && (
              <div className="flex flex-col gap-1 p-3 rounded-lg border border-amber-200 bg-amber-50">
                <p className="text-sm text-amber-700">
                  {images!.length} of {imagePrompts!.length} images generated.
                </p>
                <Button variant="outline" onPress={retryImages}>Retry missing images</Button>
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {images && groups && images.map((img) => {
                const group = groups[img.groupIndex];
                return (
                  <div key={img.groupIndex} className="flex flex-col gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`data:${img.mimeType};base64,${img.imageBase64}`}
                      alt={`Sentence ${img.groupIndex + 1}`}
                      className="w-full rounded-lg object-cover aspect-[9/16]"
                    />
                    {group && (
                      <p className="text-xs text-gray-500 italic text-center line-clamp-2">{group.text}</p>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="shrink-0" onPress={() => setStep(3)}>Back</Button>
              <Button fullWidth isDisabled={isLoading || !!missingImages} onPress={() => { setStep(5); render(); }}>Render video</Button>
            </div>
          </div>
        )}

        {/* Step 5 — Render */}
        {step === 5 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              {loadingMsg && <LoadingRow label={loadingMsg} />}
              {error && <ErrorBlock message={error} onRetry={render} />}
              {videoUrl && (
                <div className="flex flex-col gap-2">
                  <Label>Your video is ready</Label>
                  <video src={videoUrl} controls className="w-full max-h-[70vh] rounded-lg mx-auto" />
                  <a
                    href={videoUrl}
                    download
                    className="text-sm text-center underline text-gray-500"
                  >
                    Download MP4
                  </a>
                </div>
              )}
            </div>
            {!videoUrl && !isLoading && (
              <Button variant="outline" onPress={() => setStep(4)}>Back</Button>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

function LoadingRow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-500">
      <svg className="w-4 h-4 animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
      </svg>
      {label}
    </div>
  );
}

function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-red-500">{message}</p>
      <Button variant="outline" onPress={onRetry}>Retry</Button>
    </div>
  );
}
