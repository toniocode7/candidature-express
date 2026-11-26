import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

// Fond animé propre à chaque style.
export const Backdrop = ({ style, pal }) => {
  if (style === "toon") return <ToonSky pal={pal} />;
  if (style === "schema") return <Blueprint pal={pal} />;
  return <AbsoluteFill style={{ background: `radial-gradient(120% 80% at 50% 30%, ${pal.fog}, ${pal.bg})` }} />;
};

const Cloud = ({ x, y, s, speed, frame }) => {
  const dx = ((x + frame * speed) % 1500) - 200;
  return (
    <svg style={{ position: "absolute", left: dx, top: y, width: 260 * s, overflow: "visible" }} viewBox="0 0 260 120">
      <path d="M40 100 Q0 100 10 70 Q15 40 55 48 Q65 10 110 18 Q150 0 170 40 Q215 25 230 60 Q265 70 245 100 Z"
        fill="#fff" stroke="#1B1B2F" strokeWidth="7" strokeLinejoin="round" />
    </svg>
  );
};

const ToonSky = ({ pal }) => {
  const f = useCurrentFrame();
  const sway = Math.sin(f / 40) * 10;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(${pal.bg}, ${pal.sky2} 70%)` }}>
      {/* soleil */}
      <div style={{ position: "absolute", right: 90, top: 140, width: 190, height: 190, borderRadius: "50%", background: pal.accent, border: "8px solid #1B1B2F", boxShadow: `0 0 0 ${26 + Math.sin(f / 10) * 6}px rgba(255,220,80,.35)` }} />
      <Cloud x={0} y={260} s={1.1} speed={1.2} frame={f} />
      <Cloud x={700} y={420} s={0.8} speed={0.8} frame={f} />
      <Cloud x={350} y={90} s={0.7} speed={1.6} frame={f} />
      {/* collines */}
      <svg style={{ position: "absolute", left: -40, bottom: 0, width: 1160, height: 520 }} viewBox="0 0 1160 520" preserveAspectRatio="none">
        <path d={`M0 260 Q 300 ${150 + sway} 600 250 T 1160 220 V520 H0Z`} fill={pal.ground2} stroke="#1B1B2F" strokeWidth="8" />
        <path d={`M0 360 Q 400 ${260 - sway} 760 350 T 1160 330 V520 H0Z`} fill={pal.ground} stroke="#1B1B2F" strokeWidth="8" />
      </svg>
    </AbsoluteFill>
  );
};

const Blueprint = ({ pal }) => {
  const f = useCurrentFrame();
  const o = interpolate(f % 120, [0, 60, 120], [0.5, 1, 0.5]);
  return (
    <AbsoluteFill style={{ background: pal.bg }}>
      <AbsoluteFill style={{ backgroundImage: `linear-gradient(${pal.grid} 2px, transparent 2px), linear-gradient(90deg, ${pal.grid} 2px, transparent 2px)`, backgroundSize: "60px 60px", backgroundPosition: `0 ${f * 0.6}px` }} />
      <AbsoluteFill style={{ background: `radial-gradient(60% 40% at 50% 35%, ${pal.line}22, transparent 70%)`, opacity: o }} />
      <div style={{ position: "absolute", left: 40, top: 40, right: 40, bottom: 40, border: `2px dashed ${pal.line}33`, borderRadius: 30 }} />
    </AbsoluteFill>
  );
};
