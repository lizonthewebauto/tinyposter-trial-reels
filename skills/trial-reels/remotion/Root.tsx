import React from "react";
import { Composition } from "remotion";
import { TrialReel } from "./TrialReel";
import { calcTrialReel, FPS, HEIGHT, WIDTH } from "./types";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="TrialReel"
      component={TrialReel}
      calculateMetadata={calcTrialReel}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      durationInFrames={300}
      defaultProps={{
        src: "source.mp4",
        flip: true,
        speed: 1.16,
        segments: [{ startSec: 0, endSec: 8, zoom: 1.12, offsetX: 24 }],
        color: { brightness: 0.01, contrast: 1.08, saturation: 1.02 },
        overlays: [
          {
            kind: "headline" as const,
            text: "YOUR HOOK HERE",
            y: 255,
            startSec: 0,
            endSec: 3,
            sizePx: 64,
            bg: "rgba(17,17,17,1)",
          },
        ],
        grain: 0.05,
        sharpen: false,
      }}
    />
  );
};
