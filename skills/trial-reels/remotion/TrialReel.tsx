import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { Grain } from "./Grain";
import { Overlay } from "./Overlays";
import { SegmentClip } from "./SegmentClip";
import { FPS, segmentFrames, type TrialReelProps } from "./types";

export const TrialReel: React.FC<TrialReelProps> = ({
  src,
  flip,
  speed,
  segments,
  color,
  overlays,
  grain,
  sharpen,
}) => {
  const clips: React.ReactNode[] = [];
  let cursor = 0;
  segments.forEach((seg, i) => {
    const dur = segmentFrames(seg, speed);
    clips.push(
      <Sequence key={`s${i}`} from={cursor} durationInFrames={dur}>
        <SegmentClip src={src} seg={seg} speed={speed} />
      </Sequence>,
    );
    cursor += dur;
  });

  const filters = [
    `brightness(${1 + color.brightness})`,
    `contrast(${color.contrast})`,
    `saturate(${color.saturation})`,
  ];
  if (sharpen) {
    filters.push("url(#tr-sharpen)");
  }

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ transform: flip ? "scaleX(-1)" : undefined }}>
        <AbsoluteFill style={{ filter: filters.join(" ") }}>
          {clips}
        </AbsoluteFill>
      </AbsoluteFill>
      <Grain opacity={grain} />
      {overlays.map((o, i) => {
        const from = Math.round(o.startSec * FPS);
        const dur = Math.max(1, Math.round((o.endSec - o.startSec) * FPS));
        return (
          <Sequence key={`o${i}`} from={from} durationInFrames={dur}>
            <Overlay spec={o} index={i} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
