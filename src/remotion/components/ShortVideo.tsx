import { loadFont } from "@remotion/google-fonts/BreeSerif";
import { Audio } from "@remotion/media";
import { AbsoluteFill, Sequence, staticFile } from "remotion";
import { z } from "zod";
import { FPS } from "../constants";
import { TimelineSchema } from "../types";
import { calculateFrameTiming } from "../utils";
import { Background } from "./Background";
import Subtitle from "./Subtitle";

export const shortVideoSchema = z.object({
  timeline: TimelineSchema.nullable(),
});

loadFont();

export const ShortVideo: React.FC<z.infer<typeof shortVideoSchema>> = ({ timeline }) => {
  if (!timeline) throw new Error("Expected timeline to be loaded");

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {timeline.elements.map((element, index) => {
        const { startFrame, duration } = calculateFrameTiming(element.startMs, element.endMs, {
          includeIntro: index === 0,
        });
        return (
          <Sequence key={`bg-${index}`} from={startFrame} durationInFrames={duration} premountFor={3 * FPS}>
            <Background item={element} />
          </Sequence>
        );
      })}

      {timeline.text.map((element, index) => {
        const { startFrame, duration } = calculateFrameTiming(element.startMs, element.endMs);
        return (
          <Sequence key={`txt-${index}`} from={startFrame} durationInFrames={duration}>
            <Subtitle text={element.text} wordTimings={element.wordTimings} />
          </Sequence>
        );
      })}

      {timeline.audio.map((element, index) => {
        const { startFrame, duration } = calculateFrameTiming(element.startMs, element.endMs);
        return (
          <Sequence key={`aud-${index}`} from={startFrame} durationInFrames={duration} premountFor={3 * FPS}>
            <Audio src={staticFile(element.audioUrl)} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
