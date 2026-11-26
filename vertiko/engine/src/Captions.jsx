import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

// Sous-titres façon TikTok : groupes de 1 à 3 mots, mot en cours surligné, petit rebond à chaque groupe.
export const Captions = ({ timing, pal, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const groups = timing.groups;
  const gi = groups.findIndex((g) => t >= g.start && t < g.end);
  if (gi < 0) return null;
  const g = groups[gi];
  const local = frame - Math.round(g.start * fps);
  const pop = spring({ frame: local, fps, config: { damping: 12, stiffness: 220, mass: 0.6 } });
  const scale = interpolate(pop, [0, 1], [0.82, 1]);

  return (
    <div style={{ position: "absolute", left: 60, right: 60, top: style === "3d" ? 1500 : 1180, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
      <div style={{ transform: `scale(${scale})`, textAlign: "center", lineHeight: 1.08 }}>
        {g.words.map((w, i) => {
          const active = t >= w.start && t < w.end + 0.05;
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                whiteSpace: "nowrap",
                margin: "0 20px",
                fontSize: 92,
                fontWeight: 900,
                letterSpacing: -1.5,
                color: active ? pal.accent : "#FFFFFF",
                WebkitTextStroke: "14px #000",
                paintOrder: "stroke fill",
                textShadow: "0 10px 24px rgba(0,0,0,.45)",
                transform: active ? "translateY(-4px) scale(1.06)" : "none",
                textTransform: "uppercase",
              }}
            >
              {w.text}
            </span>
          );
        })}
      </div>
    </div>
  );
};
