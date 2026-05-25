import React from "react";
import { loadFont } from "@remotion/google-fonts/BreeSerif";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { WordTiming } from "../types";

const { fontFamily } = loadFont();

const OUTLINE = "-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 3px 0 #000, 3px 0 0 #000, -3px 0 0 #000, 0 -3px 0 #000";

const Subtitle: React.FC<{ text: string; wordTimings?: WordTiming[] }> = ({ text, wordTimings }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentMs = (frame / fps) * 1000;

  const containerStyle: React.CSSProperties = {
    position: "absolute",
    bottom: 540,
    left: 0,
    right: 0,
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    gap: "0 12px",
    padding: "0 48px",
    fontFamily,
    fontSize: 64,
    fontWeight: "bold",
    textTransform: "uppercase",
    lineHeight: 1.25,
    textShadow: OUTLINE,
  };

  if (!wordTimings || wordTimings.length === 0) {
    return (
      <AbsoluteFill>
        <div style={containerStyle}>
          <span style={{ color: "white" }}>{text}</span>
        </div>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill>
      <div style={containerStyle}>
        {wordTimings.map((w, i) => {
          const isActive = currentMs >= w.startMs && currentMs < w.endMs;
          return (
            <span key={i} style={{ color: isActive ? "#FFD700" : "white" }}>
              {w.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export default Subtitle;
