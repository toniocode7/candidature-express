import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";

/*
  Types de scènes (champ "visual.kind" du scénario) :
  - title    { emoji, text }                      accroche d'ouverture
  - emoji    { items:[emoji...], label?, motion? } un ou plusieurs personnages / objets
  - counter  { to, from?, suffix?, label, emoji? } un chiffre qui défile
  - bars     { items:[{label, value, emoji?}], unit? }
  - compare  { left:{emoji,label}, right:{emoji,label}, verdict? }
  - steps    { items:[{emoji,label}] }            étapes reliées par des flèches
  - fact     { text, emoji? }                     carte « le saviez-vous »
  - question { text }                             fin avec question pour les commentaires
  En 3D, les objets sont dessinés par la scène 3D (three/Stage3D.jsx) ; ici on n'affiche que les textes.
*/

const useIn = (delay = 0, cfg = { damping: 13, stiffness: 160 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: f - delay, fps, config: cfg });
};

// ---------- Briques graphiques selon le style ----------
const Card = ({ style, pal, children, w = 900, pad = 46, rot = 0, extra = {} }) => {
  const base = { width: w, padding: pad, borderRadius: 44, transform: `rotate(${rot}deg)`, ...extra };
  if (style === "toon") return <div style={{ ...base, background: pal.card, border: "8px solid #1B1B2F", boxShadow: "14px 16px 0 #1B1B2F", color: pal.ink }}>{children}</div>;
  if (style === "schema") return <div style={{ ...base, background: pal.card, border: `3px solid ${pal.line}`, boxShadow: `0 0 40px ${pal.line}44`, color: pal.ink }}>{children}</div>;
  return <div style={{ ...base, background: pal.card, border: "2px solid rgba(255,255,255,.25)", backdropFilter: "blur(18px)", boxShadow: "0 30px 80px rgba(0,0,0,.4)", color: pal.ink }}>{children}</div>;
};

const Emoji = ({ e, size, style, pal, wobble = 0 }) => {
  const f = useCurrentFrame();
  const t = f / 30;
  const squash = style === "toon" ? 1 + Math.sin(t * 6 + wobble) * 0.05 : 1;
  const bob = Math.sin(t * 3 + wobble) * (style === "toon" ? 14 : 8);
  const glyph = <span style={{ fontSize: size * 0.62, lineHeight: 1, filter: "drop-shadow(0 10px 10px rgba(0,0,0,.25))" }}>{e}</span>;
  const ring =
    style === "toon"
      ? { background: "#fff", border: "8px solid #1B1B2F", boxShadow: "10px 12px 0 #1B1B2F" }
      : { background: `${pal.card}`, border: `3px solid ${pal.line}`, boxShadow: `0 0 50px ${pal.line}55` };
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", display: "grid", placeItems: "center", transform: `translateY(${bob}px) scale(${1 / squash}, ${squash})`, ...ring }}>
      {glyph}
    </div>
  );
};

const Headline = ({ text, size = 88, color, align = "center" }) => (
  <div style={{ fontSize: size, fontWeight: 900, lineHeight: 1.02, letterSpacing: -2, color, textAlign: align }}>{text}</div>
);

const Area = ({ children, top = 170, height = 960 }) => (
  <AbsoluteFill style={{ top, height, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 40 }}>{children}</AbsoluteFill>
);

const fmt = (n) => Math.round(n).toLocaleString("fr-FR");
// Taille du grand chiffre : le plus gros possible sans dépasser la carte (~820 px utiles).
const bigSize = (txt) => Math.min(210, Math.floor(1500 / Math.max(4, txt.length)));

// ---------- Scènes ----------
const Title = ({ v, style, pal }) => {
  const a = useIn(0), b = useIn(6);
  if (style === "3d") return <Area top={120} height={520}><div style={{ transform: `scale(${b})` }}><Card style={style} pal={pal} w={920}><Headline text={v.text} size={92} color="#fff" /></Card></div></Area>;
  return (
    <Area>
      <div style={{ transform: `scale(${a}) rotate(${(1 - a) * -30}deg)` }}><Emoji e={v.emoji} size={380} style={style} pal={pal} /></div>
      <div style={{ transform: `translateY(${(1 - b) * 200}px)`, opacity: b }}>
        <Card style={style} pal={pal} rot={style === "toon" ? -2 : 0}><Headline text={v.text} color={pal.ink} /></Card>
      </div>
    </Area>
  );
};

const EmojiScene = ({ v, style, pal }) => {
  const items = v.items || [v.emoji];
  const size = items.length === 1 ? 460 : items.length === 2 ? 340 : 260;
  if (style === "3d") return v.label ? <Area top={120} height={360}><LabelCard v={v} style={style} pal={pal} /></Area> : null;
  return (
    <Area>
      <div style={{ display: "flex", gap: 40, flexWrap: "wrap", justifyContent: "center", maxWidth: 960 }}>
        {items.map((e, i) => <Pop key={i} delay={i * 6}><Emoji e={e} size={size} style={style} pal={pal} wobble={i} /></Pop>)}
      </div>
      {v.label && <LabelCard v={v} style={style} pal={pal} />}
    </Area>
  );
};

const LabelCard = ({ v, style, pal }) => {
  const a = useIn(8);
  return <div style={{ opacity: a, transform: `translateY(${(1 - a) * 80}px)` }}><Card style={style} pal={pal} w={860} pad={34}><Headline text={v.label} size={64} color={style === "3d" ? "#fff" : pal.ink} /></Card></div>;
};

const Pop = ({ delay = 0, children }) => {
  const a = useIn(delay, { damping: 9, stiffness: 180 });
  return <div style={{ transform: `scale(${a})` }}>{children}</div>;
};

const Counter = ({ v, style, pal }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [4, 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: (x) => 1 - Math.pow(1 - x, 3) });
  const val = (v.from || 0) + (v.to - (v.from || 0)) * p;
  const a = useIn(0);
  const color = style === "toon" ? pal.ink : style === "schema" ? pal.accent : "#fff";
  const top = style === "3d" ? 120 : 170, h = style === "3d" ? 460 : 960;
  return (
    <Area top={top} height={h}>
      {v.emoji && style !== "3d" && <Pop><Emoji e={v.emoji} size={260} style={style} pal={pal} /></Pop>}
      <div style={{ transform: `scale(${a})` }}>
        <Card style={style} pal={pal} w={920}>
          <div style={{ fontSize: bigSize(fmt(v.to) + (v.suffix || "")), fontWeight: 900, letterSpacing: -6, lineHeight: 1, color, textAlign: "center", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{fmt(val)}{v.suffix ? "\u00A0" + v.suffix.trim() : ""}</div>
          <div style={{ fontSize: 54, fontWeight: 700, textAlign: "center", marginTop: 14, color: style === "3d" ? "#fff" : pal.ink, opacity: 0.85 }}>{v.label}</div>
        </Card>
      </div>
    </Area>
  );
};

const Bars = ({ v, style, pal }) => {
  const f = useCurrentFrame();
  const max = Math.max(...v.items.map((i) => i.value));
  if (style === "3d") return <Area top={110} height={260}><Card style={style} pal={pal} w={900} pad={28}><Headline text={v.title || ""} size={58} color="#fff" /></Card></Area>;
  const colors = [pal.accent, pal.accent2, style === "toon" ? "#6DD3FF" : pal.line, "#B892FF"];
  return (
    <Area>
      <Card style={style} pal={pal} w={940} pad={50}>
        {v.title && <div style={{ fontSize: 56, fontWeight: 900, marginBottom: 34, color: pal.ink }}>{v.title}</div>}
        {v.items.map((it, i) => {
          const p = interpolate(f, [6 + i * 8, 34 + i * 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: (x) => 1 - Math.pow(1 - x, 3) });
          return (
            <div key={i} style={{ marginBottom: 30 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 44, fontWeight: 800, color: pal.ink }}>
                <span>{it.emoji ? it.emoji + " " : ""}{it.label}</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(it.value * p)}{v.unit || ""}</span>
              </div>
              <div style={{ height: 54, borderRadius: 30, marginTop: 12, background: style === "toon" ? "#EEE" : "rgba(255,255,255,.07)", border: style === "toon" ? "6px solid #1B1B2F" : `2px solid ${pal.line}55`, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(it.value / max) * 100 * p}%`, background: colors[i % colors.length], borderRight: style === "toon" ? "6px solid #1B1B2F" : "none", boxShadow: style === "schema" ? `0 0 30px ${colors[i % colors.length]}` : "none" }} />
              </div>
            </div>
          );
        })}
      </Card>
    </Area>
  );
};

const Compare = ({ v, style, pal }) => {
  const a = useIn(0), b = useIn(8), c = useIn(18);
  if (style === "3d") {
    return (
      <AbsoluteFill>
        <div style={{ position: "absolute", top: 1300, left: 60, width: 440, opacity: a }}><Card style={style} pal={pal} w={440} pad={26}><Headline text={v.left.label} size={50} color="#fff" /></Card></div>
        <div style={{ position: "absolute", top: 1300, right: 60, width: 440, opacity: b }}><Card style={style} pal={pal} w={440} pad={26}><Headline text={v.right.label} size={50} color="#fff" /></Card></div>
        {v.verdict && <div style={{ position: "absolute", top: 120, left: 80, right: 80, opacity: c }}><Card style={style} pal={pal} w={920} pad={30}><Headline text={v.verdict} size={60} color="#fff" /></Card></div>}
      </AbsoluteFill>
    );
  }
  const Side = ({ s, k }) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 26, transform: `scale(${k})` }}>
      <Emoji e={s.emoji} size={300} style={style} pal={pal} wobble={k * 3} />
      <Card style={style} pal={pal} w={420} pad={24}><Headline text={s.label} size={48} color={pal.ink} /></Card>
    </div>
  );
  return (
    <Area>
      <div style={{ display: "flex", gap: 40, alignItems: "center" }}>
        <Side s={v.left} k={a} />
        <div style={{ fontSize: 90, fontWeight: 900, color: style === "toon" ? "#1B1B2F" : pal.accent, transform: `scale(${b})` }}>VS</div>
        <Side s={v.right} k={b} />
      </div>
      {v.verdict && <div style={{ opacity: c, transform: `translateY(${(1 - c) * 60}px)` }}><Card style={style} pal={pal} w={900} pad={30} rot={style === "toon" ? 1.5 : 0}><Headline text={v.verdict} size={58} color={pal.ink} /></Card></div>}
    </Area>
  );
};

const Steps = ({ v, style, pal }) => {
  const f = useCurrentFrame();
  if (style === "3d") return null;
  const n = v.items.length;
  return (
    <Area>
      <div style={{ display: "flex", flexDirection: "column", gap: 20, alignItems: "stretch", width: 920 }}>
        {v.items.map((it, i) => {
          const p = interpolate(f, [i * 12, i * 12 + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <React.Fragment key={i}>
              <div style={{ opacity: p, transform: `translateX(${(1 - p) * (i % 2 ? 120 : -120)}px)`, display: "flex", alignItems: "center", gap: 30 }}>
                <Emoji e={it.emoji} size={170} style={style} pal={pal} wobble={i} />
                <Card style={style} pal={pal} w={700} pad={30}><div style={{ fontSize: 50, fontWeight: 800, color: pal.ink }}>{it.label}</div></Card>
              </div>
              {i < n - 1 && <div style={{ marginLeft: 70, height: 50, width: 8, borderRadius: 4, background: style === "toon" ? "#1B1B2F" : pal.line, opacity: p, transformOrigin: "top", transform: `scaleY(${p})` }} />}
            </React.Fragment>
          );
        })}
      </div>
    </Area>
  );
};

const Fact = ({ v, style, pal }) => {
  const a = useIn(0);
  const top = style === "3d" ? 120 : 170, h = style === "3d" ? 520 : 960;
  return (
    <Area top={top} height={h}>
      {v.emoji && style !== "3d" && <Pop><Emoji e={v.emoji} size={300} style={style} pal={pal} /></Pop>}
      <div style={{ transform: `scale(${0.8 + a * 0.2})`, opacity: a }}>
        <Card style={style} pal={pal} w={920} rot={style === "toon" ? 1.5 : 0}>
          {v.kicker && <div style={{ fontSize: 40, fontWeight: 800, color: style === "toon" ? pal.accent2 : pal.accent, marginBottom: 14, textTransform: "uppercase", letterSpacing: 2 }}>{v.kicker}</div>}
          <Headline text={v.text} size={74} color={style === "3d" ? "#fff" : pal.ink} align="left" />
        </Card>
      </div>
    </Area>
  );
};

const Question = ({ v, style, pal }) => {
  const a = useIn(0, { damping: 8, stiffness: 140 });
  const f = useCurrentFrame();
  return (
    <Area top={style === "3d" ? 140 : 220} height={style === "3d" ? 600 : 900}>
      <div style={{ transform: `scale(${a}) rotate(${Math.sin(f / 8) * 1.5}deg)` }}>
        <Card style={style} pal={pal} w={920}>
          <div style={{ fontSize: 120, textAlign: "center" }}>💬</div>
          <Headline text={v.text} size={76} color={style === "3d" ? "#fff" : pal.ink} />
          <div style={{ marginTop: 26, textAlign: "center", fontSize: 40, fontWeight: 700, opacity: 0.7, color: style === "3d" ? "#fff" : pal.ink }}>Réponds en commentaire 👇</div>
        </Card>
      </div>
    </Area>
  );
};

const KINDS = { title: Title, emoji: EmojiScene, counter: Counter, bars: Bars, compare: Compare, steps: Steps, fact: Fact, question: Question };

export const SceneView = ({ scene, style, pal }) => {
  const C = KINDS[scene.visual?.kind] || Fact;
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const out = interpolate(f, [durationInFrames - 6, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ opacity: out }}><C v={scene.visual || { text: scene.say }} style={style} pal={pal} /></AbsoluteFill>;
};
