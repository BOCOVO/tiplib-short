import { staticFile } from "remotion";
import { FPS } from "./constants";
import type { Timeline } from "./types";

export const loadTimelineFromFile = async (path: string) => {
  const res = await fetch(staticFile(path));
  const timeline = (await res.json()) as Timeline;
  timeline.elements.sort((a, b) => a.startMs - b.startMs);
  const lastEndMs = timeline.audio[0]?.endMs ?? timeline.elements.at(-1)?.endMs ?? 0;
  const lengthFrames = Math.ceil((lastEndMs / 1000) * FPS);
  return { timeline, lengthFrames };
};
