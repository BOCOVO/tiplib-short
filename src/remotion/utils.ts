import { FPS } from "./constants";
import type { BackgroundElement } from "./types";

export const calculateFrameTiming = (
  startMs: number,
  endMs: number,
  options: { includeIntro?: boolean; addIntroOffset?: boolean } = {},
) => {
  const { includeIntro = false, addIntroOffset = false } = options;
  const startFrame = (startMs * FPS) / 1000 + (addIntroOffset ? 0 : 0);
  const duration = ((endMs - startMs) * FPS) / 1000 + (includeIntro ? 0 : 0);
  return { startFrame: Math.round(startFrame), duration: Math.max(1, Math.round(duration)) };
};

export const calculateBlur = ({
  item,
  localMs,
}: {
  item: BackgroundElement;
  localMs: number;
}) => {
  const fadeMs = 1000;
  const startMs = item.startMs;
  const endMs = item.endMs;

  if (item.enterTransition === "blur" && localMs < fadeMs) {
    return 1 - localMs / fadeMs;
  }
  if (item.exitTransition === "blur" && localMs > endMs - startMs - fadeMs) {
    return 1 - (endMs - startMs - localMs) / fadeMs;
  }
  return 0;
};
