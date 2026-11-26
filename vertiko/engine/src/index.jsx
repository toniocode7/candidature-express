import { registerRoot, Composition } from "remotion";
import { Short } from "./Short.jsx";

export const FPS = 30;

const Root = () => (
  <Composition
    id="Short"
    component={Short}
    fps={FPS}
    width={1080}
    height={1920}
    durationInFrames={300}
    defaultProps={{ story: null, timing: null }}
    calculateMetadata={({ props }) => ({
      durationInFrames: props.timing ? Math.ceil(props.timing.total * FPS) : 300,
    })}
  />
);

registerRoot(Root);
