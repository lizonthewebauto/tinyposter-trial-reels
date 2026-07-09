import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import {
  clamp,
  POPUP_H,
  POPUP_W,
  SAFE,
  type OverlaySpec,
} from "./types";

const FONT_STACK =
  "'Arial Black', Arial, Helvetica, 'Segoe UI', sans-serif";

/**
 * One on-screen text box. Geometry is clamped to the safe zone here,
 * so even a hand-edited plan cannot push text under platform UI.
 */
export const Overlay: React.FC<{ spec: OverlaySpec; index: number }> = ({
  spec,
  index,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const pop = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.6 },
    durationInFrames: 8,
  });

  const isPopup = spec.kind === "popup";
  const rotation = isPopup ? (index % 2 === 0 ? -2 : 2) : 0;

  if (isPopup) {
    const x = clamp(spec.x ?? SAFE.xMin + 28, SAFE.xMin, SAFE.xMax - POPUP_W);
    const y = clamp(spec.y, SAFE.yMin, SAFE.yMax - POPUP_H);
    return (
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: POPUP_W,
          minHeight: POPUP_H,
          background: spec.bg,
          color: spec.color ?? "#fff",
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "10px 22px",
          fontFamily: FONT_STACK,
          fontWeight: 900,
          fontSize: spec.sizePx,
          lineHeight: 1.12,
          textAlign: "center",
          textTransform: "uppercase",
          transform: `rotate(${rotation}deg) scale(${pop})`,
          boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
        }}
      >
        {spec.text}
      </div>
    );
  }

  const headlineHeight = Math.round(spec.sizePx * 1.5);
  const y = clamp(spec.y, SAFE.yMin, SAFE.yMax - headlineHeight);
  return (
    <div
      style={{
        position: "absolute",
        left: SAFE.xMin,
        top: y,
        width: SAFE.xMax - SAFE.xMin,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `scale(${pop})`,
      }}
    >
      <div
        style={{
          background: spec.bg,
          color: spec.color ?? "#fff",
          borderRadius: 10,
          padding: "16px 30px",
          fontFamily: FONT_STACK,
          fontWeight: 900,
          fontSize: spec.sizePx,
          lineHeight: 1.14,
          textAlign: "center",
          textTransform: "uppercase",
          textShadow: "0 2px 8px rgba(0,0,0,0.45)",
          maxWidth: "100%",
        }}
      >
        {spec.text}
      </div>
    </div>
  );
};
