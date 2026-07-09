import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

/**
 * Animated film grain. A new noise seed every frame gives temporal
 * noise, which makes each render pixel-unique. Also hosts the shared
 * sharpen filter definition used by the video layer.
 */
export const Grain: React.FC<{ opacity: number }> = ({ opacity }) => {
  const frame = useCurrentFrame();
  if (opacity <= 0) {
    return <SharpenDef />;
  }
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <SharpenDef />
      <svg
        width="100%"
        height="100%"
        style={{ opacity, mixBlendMode: "overlay" }}
      >
        <filter id="tr-grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="2"
            seed={frame}
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#tr-grain)" />
      </svg>
    </AbsoluteFill>
  );
};

/** Mild unsharp-mask style kernel, referenced as filter: url(#tr-sharpen). */
const SharpenDef: React.FC = () => (
  <svg width="0" height="0" style={{ position: "absolute" }}>
    <filter id="tr-sharpen">
      <feConvolveMatrix
        order="3"
        kernelMatrix="0 -0.25 0 -0.25 2 -0.25 0 -0.25 0"
        preserveAlpha="true"
      />
    </filter>
  </svg>
);
