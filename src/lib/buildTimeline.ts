import type { ElementAnimation, Timeline, WordTiming } from "@/remotion/types";
import type { WordTimestamp } from "@/app/api/generate/timestamps/route";

export interface SegmentInput {
  text: string;
  imageUrl: string;  // relative to public/
  startMs: number;
  durationMs: number;
}

const WINDOW_SIZE = 8;

export function buildTimeline(
  segments: SegmentInput[],
  audioUrl: string, // relative to public/
  totalDurationMs: number,
  words: WordTimestamp[],
): Timeline {
  const elements = [];
  const text = [];
  let zoomIn = true;

  for (let segIdx = 0; segIdx < segments.length; segIdx++) {
    const segment = segments[segIdx];
    const nextSegmentStartMs = segments[segIdx + 1]?.startMs ?? totalDurationMs;

    // Background covers from this sentence start (0 for first) to next sentence start
    const bgStartMs = segIdx === 0 ? 0 : segment.startMs;
    const bgEndMs = nextSegmentStartMs;
    const bgDurationMs = bgEndMs - bgStartMs;

    elements.push({
      startMs: bgStartMs,
      endMs: bgEndMs,
      imageUrl: segment.imageUrl,
      enterTransition: "blur" as const,
      exitTransition: "blur" as const,
      animations: bgAnimations(bgDurationMs, zoomIn),
    });

    // Filter words belonging to this segment (by absolute time)
    const segWords = words.filter(
      (w) => w.start * 1000 >= segment.startMs && w.start * 1000 < segment.startMs + segment.durationMs,
    );

    if (segWords.length > 0) {
      for (let i = 0; i < segWords.length; i += WINDOW_SIZE) {
        const chunk = segWords.slice(i, i + WINDOW_SIZE);
        const windowStartMs = chunk[0].start * 1000;
        // Extend last window to next sentence start (fills inter-sentence pauses)
        const nextChunk = segWords[i + WINDOW_SIZE];
        const windowEndMs = nextChunk ? nextChunk.start * 1000 : nextSegmentStartMs;

        const wordTimings: WordTiming[] = chunk.map((w) => ({
          text: w.word,
          startMs: w.start * 1000 - windowStartMs,
          endMs: w.end * 1000 - windowStartMs,
        }));

        text.push({
          startMs: windowStartMs,
          endMs: windowEndMs,
          text: chunk.map((w) => w.word).join(" "),
          position: "center" as const,
          wordTimings,
        });
      }
    } else {
      text.push({
        startMs: bgStartMs,
        endMs: bgEndMs,
        text: segment.text,
        position: "center" as const,
      });
    }

    zoomIn = !zoomIn;
  }

  return {
    shortTitle: "",
    elements,
    text,
    audio: [{ startMs: 0, endMs: totalDurationMs, audioUrl }],
  };
}

function bgAnimations(durationMs: number, zoomIn: boolean): ElementAnimation[] {
  return [
    { type: "scale", from: zoomIn ? 1.5 : 1, to: zoomIn ? 1 : 1.5, startMs: 0, endMs: durationMs },
  ];
}
