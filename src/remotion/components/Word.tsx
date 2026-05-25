import { makeTransform, scale, translateY } from "@remotion/animation-utils";
import { loadFont } from "@remotion/google-fonts/BreeSerif";
import { fitText } from "@remotion/layout-utils";
import type React from "react";
import { AbsoluteFill, interpolate, useVideoConfig } from "remotion";

const { fontFamily } = loadFont();

export const Word: React.FC<{
  enterProgress: number;
  text: string;
  stroke: boolean;
}> = ({ enterProgress, text, stroke }) => {
  const { width } = useVideoConfig();
  const desiredFontSize = 110;

  const fittedText = fitText({
    fontFamily,
    text,
    withinWidth: width * 0.82,
  });

  const fontSize = Math.min(desiredFontSize, fittedText.fontSize);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        top: undefined,
        bottom: 320,
        height: 160,
      }}
    >
      <div
        style={{
          fontSize,
          color: "white",
          WebkitTextStroke: stroke ? "18px black" : undefined,
          transform: makeTransform([
            scale(interpolate(enterProgress, [0, 1], [0.85, 1])),
            translateY(interpolate(enterProgress, [0, 1], [40, 0])),
          ]),
          fontFamily,
          textTransform: "uppercase",
          textAlign: "center",
          lineHeight: 1.1,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};
