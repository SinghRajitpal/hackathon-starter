"use client";

import { useEffect, useMemo, useRef } from "react";

const LINE_COUNT = 140;
const REPEL_ARC = 70;
const MAX_OFFSET_DEG = 14;
const EASE = 0.12;

function mulberry32(seed: number) {
  return function random() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function useFanLines() {
  return useMemo(() => {
    const random = mulberry32(42);
    return Array.from({ length: LINE_COUNT }, (_, i) => {
      const t = i / (LINE_COUNT - 1);
      const angle = -96 + t * 192 + (random() - 0.5) * 2.5;
      const length = 130 + random() * 260;
      return { angle, length };
    });
  }, []);
}

function shortestAngleDiff(a: number, b: number) {
  let diff = (a - b) % 360;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return diff;
}

export function SustainabilityFan() {
  const lines = useFanLines();
  const svgRef = useRef<SVGSVGElement>(null);
  const groupRefs = useRef<(SVGGElement | null)[]>([]);
  const lineRefs = useRef<(SVGLineElement | null)[]>([]);
  const dotRefs = useRef<(SVGCircleElement | null)[]>([]);
  const pointer = useRef({ angle: 0, radius: 0, active: false });
  const currentAngle = useRef(lines.map((l) => l.angle));
  const currentOpacity = useRef(lines.map(() => 0.5));

  useEffect(() => {
    let frame = 0;

    const tick = () => {
      for (let i = 0; i < lines.length; i++) {
        const base = lines[i];
        let targetAngle = base.angle;
        let targetOpacity = 0.5;

        if (pointer.current.active) {
          const angleDiff = shortestAngleDiff(base.angle, pointer.current.angle);
          const arcDist =
            (pointer.current.radius * Math.abs(angleDiff) * Math.PI) / 180;

          if (arcDist < REPEL_ARC) {
            const falloff = 1 - arcDist / REPEL_ARC;
            const sign = angleDiff >= 0 ? 1 : -1;
            targetAngle = base.angle + sign * MAX_OFFSET_DEG * falloff;
            targetOpacity = 0.5 + 0.5 * falloff;
          }
        }

        currentAngle.current[i] += (targetAngle - currentAngle.current[i]) * EASE;
        currentOpacity.current[i] +=
          (targetOpacity - currentOpacity.current[i]) * EASE;

        const g = groupRefs.current[i];
        if (g) g.setAttribute("transform", `rotate(${currentAngle.current[i]})`);

        const opacity = String(currentOpacity.current[i]);
        const line = lineRefs.current[i];
        if (line) line.setAttribute("opacity", opacity);
        const dot = dotRefs.current[i];
        if (dot) dot.setAttribute("opacity", opacity);
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [lines]);

  const updatePointer = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const viewBox = svg.viewBox.baseVal;
    const px =
      viewBox.x + ((clientX - rect.left) / rect.width) * viewBox.width;
    const py =
      viewBox.y + ((clientY - rect.top) / rect.height) * viewBox.height;

    const radius = Math.hypot(px, py);
    const angle = (Math.atan2(px, -py) * 180) / Math.PI;
    pointer.current = { angle, radius, active: true };
  };

  return (
    <svg
      ref={svgRef}
      viewBox="-380 -420 760 440"
      className="h-auto w-full overflow-visible"
      onMouseMove={(e) => updatePointer(e.clientX, e.clientY)}
      onMouseLeave={() => {
        pointer.current.active = false;
      }}
    >
      {lines.map((line, i) => (
        <g
          key={i}
          ref={(el) => {
            groupRefs.current[i] = el;
          }}
        >
          <line
            ref={(el) => {
              lineRefs.current[i] = el;
            }}
            x1="0"
            y1="0"
            x2="0"
            y2={-line.length}
            stroke="white"
            strokeWidth={1}
            opacity={0.5}
          />
          <circle
            ref={(el) => {
              dotRefs.current[i] = el;
            }}
            cx="0"
            cy={-line.length}
            r={1.6}
            fill="white"
            opacity={0.5}
          />
        </g>
      ))}
    </svg>
  );
}
