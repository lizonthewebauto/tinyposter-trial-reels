import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile } from "remotion";
import { FPS, type SegmentSpec } from "./types";

export const SegmentClip: React.FC<{
  src: string;
  seg: SegmentSpec;
  speed: number;
}> = ({ src, seg, speed }) => {
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <OffthreadVideo
        src={staticFile(src)}
        trimBefore={Math.round(seg.startSec * FPS)}
        trimAfter={Math.round(seg.endSec * FPS)}
        playbackRate={speed}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${seg.zoom}) translateX(${
            seg.offsetX / seg.zoom
          }px)`,
        }}
      />
    </AbsoluteFill>
  );
};
