import { z } from "zod";

const TimelineElementSchema = z.object({
  startMs: z.number(),
  endMs: z.number(),
});

const ElementAnimationSchema = TimelineElementSchema.extend({
  type: z.literal("scale"),
  from: z.number(),
  to: z.number(),
});

const BackgroundElementSchema = TimelineElementSchema.extend({
  imageUrl: z.string(),
  enterTransition: z.union([z.literal("fade"), z.literal("blur"), z.literal("none")]).optional(),
  exitTransition: z.union([z.literal("fade"), z.literal("blur"), z.literal("none")]).optional(),
  animations: z.array(ElementAnimationSchema).optional(),
});

const WordTimingSchema = z.object({
  text: z.string(),
  startMs: z.number(),
  endMs: z.number(),
});

const TextElementSchema = TimelineElementSchema.extend({
  text: z.string(),
  position: z.union([z.literal("top"), z.literal("bottom"), z.literal("center")]),
  animations: z.array(ElementAnimationSchema).optional(),
  wordTimings: z.array(WordTimingSchema).optional(),
});

const AudioElementSchema = TimelineElementSchema.extend({
  audioUrl: z.string(),
});

export const TimelineSchema = z.object({
  shortTitle: z.string(),
  elements: z.array(BackgroundElementSchema),
  text: z.array(TextElementSchema),
  audio: z.array(AudioElementSchema),
});

export type ElementAnimation = z.infer<typeof ElementAnimationSchema>;
export type BackgroundElement = z.infer<typeof BackgroundElementSchema>;
export type TextElement = z.infer<typeof TextElementSchema>;
export type WordTiming = z.infer<typeof WordTimingSchema>;
export type AudioElement = z.infer<typeof AudioElementSchema>;
export type Timeline = z.infer<typeof TimelineSchema>;
