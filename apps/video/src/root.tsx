import { Composition } from "remotion";
import { CapynPublicAlpha } from "./video";

export function CapynVideoRoot() {
  return (
    <Composition
      id="CapynPublicAlpha"
      component={CapynPublicAlpha}
      durationInFrames={720}
      fps={30}
      width={1920}
      height={1080}
    />
  );
}
