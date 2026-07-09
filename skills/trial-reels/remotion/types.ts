import type { CalculateMetadataFunction } from "remotion";

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

// Keep all text inside this box so platform buttons and captions
// (Instagram, TikTok, YouTube Shorts UI) never cover it.
export const SAFE = {
  xMin: 84,
  xMax: 996,
  yMin: 255,
  yMax: 1350,
};

export const POPUP_W = 410;
export const POPUP_H = 104;

export type SegmentSpec = {
  /** Start time in SOURCE video seconds. */
  startSec: number;
  /** End time in SOURCE video seconds. */
  endSec: number;
  /** 1.0 to 1.5. Scales the clip up for a punch-in look. */
  zoom: number;
  /** Horizontal pan in px, -60 to 60, applied before the flip. */
  offsetX: number;
};

export type OverlaySpec = {
  kind: "headline" | "popup";
  text: string;
  /** Popup only. Left edge in px. Clamped to the safe zone. */
  x?: number;
  /** Top edge in px. Clamped to the safe zone. */
  y: number;
  /** Start time in OUTPUT seconds (after speed-up). */
  startSec: number;
  /** End time in OUTPUT seconds. */
  endSec: number;
  sizePx: number;
  /** CSS background color of the text box. */
  bg: string;
  /** Text color. Default white. */
  color?: string;
};

export type TrialReelProps = {
  /** File name inside public/, e.g. "source.mp4". */
  src: string;
  flip: boolean;
  /** Playback speed, 1.0 to 1.3. */
  speed: number;
  segments: SegmentSpec[];
  color: { brightness: number; contrast: number; saturation: number };
  overlays: OverlaySpec[];
  /** Film grain opacity, 0 to 1. Around 0.05 is enough. */
  grain: number;
  /** Extra sharpen pass. Costs render time. */
  sharpen: boolean;
};

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/**
 * Output frames one segment occupies after speed-up.
 * The single source of truth for duration math. The composition,
 * calculateMetadata, and the render driver all use this.
 */
export const segmentFrames = (seg: SegmentSpec, speed: number): number =>
  Math.max(1, Math.round(((seg.endSec - seg.startSec) / speed) * FPS));

export const totalFrames = (segments: SegmentSpec[], speed: number): number =>
  segments.reduce((sum, seg) => sum + segmentFrames(seg, speed), 0);

export const calcTrialReel: CalculateMetadataFunction<TrialReelProps> = ({
  props,
}) => ({
  durationInFrames: Math.max(1, totalFrames(props.segments, props.speed)),
  fps: FPS,
  width: WIDTH,
  height: HEIGHT,
});
