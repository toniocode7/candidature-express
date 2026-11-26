import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";

// Scène 3D continue : la caméra bouge pendant tout le short et chaque scène du scénario
// fait apparaître ses objets (médaillons emoji, barres, colonnes, podiums).

const texCache = new Map();
function emojiTexture(e, bg) {
  const key = e + bg;
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(200, 170, 40, 256, 256, 280);
  grd.addColorStop(0, "#ffffff");
  grd.addColorStop(1, bg);
  g.fillStyle = grd;
  g.beginPath(); g.arc(256, 256, 256, 0, Math.PI * 2); g.fill();
  g.font = '300px "Noto Color Emoji"';
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(e, 256, 280);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, t);
  return t;
}

function textTexture(text) {
  const key = "txt:" + text;
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 256;
  const g = c.getContext("2d");
  g.font = '900 120px Inter';
  g.textAlign = "center"; g.textBaseline = "middle";
  g.lineWidth = 22; g.strokeStyle = "rgba(0,0,0,.85)"; g.strokeText(text, 512, 128);
  g.fillStyle = "#fff"; g.fillText(text, 512, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, t);
  return t;
}

const Medallion = ({ e, pal, pos = [0, 0, 0], scale = 1, t = 0, appear = 1 }) => {
  const tex = useMemo(() => emojiTexture(e, pal.key), [e, pal.key]);
  const s = scale * appear;
  return (
    <group position={[pos[0], pos[1] + Math.sin(t * 2 + pos[0]) * 0.12, pos[2]]} rotation={[0, Math.sin(t * 1.3 + pos[0]) * 0.45 + (1 - appear) * 3, 0]} scale={[s, s, s]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1, 1, 0.28, 64]} />
        <meshStandardMaterial color={pal.accent} metalness={0.7} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0, 0.145]}>
        <circleGeometry args={[0.9, 64]} />
        <meshStandardMaterial map={tex} roughness={0.35} metalness={0.05} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.02, 0.07, 16, 64]} />
        <meshStandardMaterial color={pal.accent2} metalness={0.9} roughness={0.2} />
      </mesh>
    </group>
  );
};

const Label = ({ text, pos, w = 2.4 }) => {
  const tex = useMemo(() => textTexture(text), [text]);
  return (
    <mesh position={pos}>
      <planeGeometry args={[w, w / 4]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} />
    </mesh>
  );
};

const Particles = ({ t, pal }) => {
  const pts = useMemo(() => {
    const a = [];
    for (let i = 0; i < 90; i++) a.push([(Math.random() - 0.5) * 14, (Math.random() - 0.5) * 18, -Math.random() * 10 - 1, Math.random() * 0.06 + 0.02, Math.random() * 6]);
    return a;
  }, []);
  return pts.map((p, i) => (
    <mesh key={i} position={[p[0] + Math.sin(t * 0.4 + p[4]) * 0.4, ((p[1] + t * 0.5 + 9) % 18) - 9, p[2]]}>
      <sphereGeometry args={[p[3], 8, 8]} />
      <meshBasicMaterial color={i % 3 ? pal.key : pal.accent2} transparent opacity={0.7} />
    </mesh>
  ));
};

const SceneObjects = ({ scene, local, dur, pal, t, fps }) => {
  const v = scene.visual || {};
  const appear = (d = 0) => spring({ frame: local - d, fps, config: { damping: 12, stiffness: 120 } });
  const out = interpolate(local, [dur - 8, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  switch (v.kind) {
    case "bars": {
      const max = Math.max(...v.items.map((i) => i.value));
      const n = v.items.length, gap = 1.7;
      const cols = [pal.accent, pal.accent2, pal.key, "#6DF2C4"];
      return v.items.map((it, i) => {
        const h = Math.max(0.05, (it.value / max) * 3.6 * appear(i * 6) * out);
        const x = (i - (n - 1) / 2) * gap;
        return (
          <group key={i} position={[x, -3.0, 0]}>
            <mesh position={[0, h / 2, 0]}>
              <boxGeometry args={[1.1, h, 1.1]} />
              <meshStandardMaterial color={cols[i % cols.length]} metalness={0.3} roughness={0.3} emissive={cols[i % cols.length]} emissiveIntensity={0.15} />
            </mesh>
            {it.emoji && <Medallion e={it.emoji} pal={pal} pos={[0, h + 0.8, 0.2]} scale={0.55} t={t} appear={appear(i * 6 + 8) * out} />}
            <Label text={it.label} pos={[0, -0.5, 0.7]} w={1.7} />
          </group>
        );
      });
    }
    case "counter": {
      const h = 3.6 * appear(0) * out;
      return (
        <group position={[0.9, -3.6, 0]}>
          {Array.from({ length: 8 }).map((_, i) => {
            const on = (i + 1) / 8 <= h / 3.6 + 0.001;
            return (
              <mesh key={i} position={[0, i * 0.48 + 0.25, 0]} scale={on ? 1 : 0.001}>
                <cylinderGeometry args={[1.1, 1.1, 0.38, 48]} />
                <meshStandardMaterial color={i % 2 ? pal.accent : pal.accent2} metalness={0.6} roughness={0.25} />
              </mesh>
            );
          })}
          {v.emoji && <Medallion e={v.emoji} pal={pal} pos={[-1.7, 1.2, 0.4]} scale={0.8} t={t} appear={appear(10) * out} />}
        </group>
      );
    }
    case "compare":
      return (
        <>
          {[v.left, v.right].map((s, i) => (
            <group key={i} position={[i ? 1.45 : -1.45, -1.9, 0]}>
              <mesh position={[0, -1.1, 0]}>
                <cylinderGeometry args={[1.05, 1.2, 0.8, 48]} />
                <meshStandardMaterial color={i ? pal.accent2 : pal.accent} metalness={0.4} roughness={0.3} />
              </mesh>
              <Medallion e={s.emoji} pal={pal} pos={[0, 0.6, 0]} scale={1.0} t={t} appear={appear(i * 8) * out} />
            </group>
          ))}
        </>
      );
    case "steps": {
      const n = v.items.length;
      return v.items.map((it, i) => {
        const y = 3 - i * (6 / Math.max(1, n - 1 || 1)) * 0.9;
        const x = Math.sin(i * 1.6) * 1.6;
        return (
          <group key={i}>
            <Medallion e={it.emoji} pal={pal} pos={[x - 1, y - 1, 0]} scale={0.8} t={t} appear={appear(i * 12) * out} />
            <Label text={it.label} pos={[x + 1.6, y - 1, 0.3]} w={2.8} />
          </group>
        );
      });
    }
    case "question":
      return <Medallion e={v.emoji || "🤔"} pal={pal} pos={[0, -1.2, 0]} scale={1.6} t={t} appear={appear(0) * out} />;
    case "fact":
    case "title":
    case "emoji":
    default: {
      const items = v.items || [v.emoji || "✨"];
      const n = items.length;
      const sc = n === 1 ? 2.0 : n === 2 ? 1.25 : 0.9;
      return items.map((e, i) => (
        <Medallion key={i} e={e} pal={pal} pos={[(i - (n - 1) / 2) * sc * 2.2, v.kind === "title" ? -0.6 : -0.4, 0]} scale={sc} t={t} appear={appear(i * 6) * out} />
      ));
    }
  }
};

export const Stage3D = ({ story, timing, pal }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const camX = Math.sin(t * 0.35) * 1.2;
  const camZ = 11 - Math.min(t, 40) * 0.03;
  return (
    <AbsoluteFill>
      <ThreeCanvas width={width} height={height} camera={{ fov: 50, position: [camX, 0.5, camZ] }} gl={{ antialias: true }}>
        <color attach="background" args={[pal.bg]} />
        <fog attach="fog" args={[pal.fog, 10, 24]} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[4, 6, 6]} intensity={2.2} color={"#ffffff"} />
        <pointLight position={[-5, -2, 4]} intensity={60} color={pal.accent} />
        <pointLight position={[5, 3, -2]} intensity={50} color={pal.accent2} />
        <Particles t={t} pal={pal} />
        {/* sol réfléchissant */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -4.2, 0]}>
          <circleGeometry args={[9, 64]} />
          <meshStandardMaterial color={pal.fog} metalness={0.8} roughness={0.35} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -4.18, 0]}>
          <ringGeometry args={[3.2, 3.35, 96]} />
          <meshBasicMaterial color={pal.accent} transparent opacity={0.6} />
        </mesh>
        {story.scenes.map((sc, i) => {
          const s = timing.scenes[i];
          const from = Math.round(s.start * fps), to = Math.round(s.end * fps);
          if (frame < from || frame >= to) return null;
          return <SceneObjects key={i} scene={sc} local={frame - from} dur={to - from} pal={pal} t={t} fps={fps} />;
        })}
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
