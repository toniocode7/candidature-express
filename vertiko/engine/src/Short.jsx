import React from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { Captions } from "./Captions.jsx";
import { Backdrop } from "./Backdrop.jsx";
import { SceneView } from "./scenes.jsx";
import { Stage3D } from "./three/Stage3D.jsx";
import { PALETTES } from "./theme.js";

// Un short = un fond selon le style + une séquence par scène + des sous-titres synchronisés à la voix.
export const Short = ({ story, timing }) => {
  const { fps } = useVideoConfig();
  if (!story || !timing) return <AbsoluteFill style={{ background: "#111" }} />;
  const pal = PALETTES[story.palette] || PALETTES[story.style] || PALETTES.toon;
  const totalFrames = Math.ceil(timing.total * fps);

  return (
    <AbsoluteFill style={{ background: pal.bg, fontFamily: "Inter, sans-serif", overflow: "hidden" }}>
      <Backdrop style={story.style} pal={pal} />
      {story.style === "3d" && <Stage3D story={story} timing={timing} pal={pal} />}
      {story.scenes.map((sc, i) => {
        const t = timing.scenes[i];
        const from = Math.round(t.start * fps);
        const dur = Math.max(1, Math.round((t.end - t.start) * fps));
        return (
          <Sequence key={i} from={from} durationInFrames={dur} name={`Scène ${i + 1}`}>
            <SceneView scene={sc} style={story.style} pal={pal} index={i} isLast={i === story.scenes.length - 1} />
          </Sequence>
        );
      })}
      <Captions timing={timing} pal={pal} style={story.style} />
      <Progress total={totalFrames} pal={pal} />
    </AbsoluteFill>
  );
};

import { useCurrentFrame } from "remotion";
const Progress = ({ total, pal }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 10, background: "rgba(255,255,255,.15)" }}>
      <div style={{ width: `${(f / total) * 100}%`, height: "100%", background: pal.accent }} />
    </div>
  );
};
