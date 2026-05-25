import { Composition, getStaticFiles } from "remotion";
import { ShortVideo, shortVideoSchema } from "./components/ShortVideo";
import { FPS } from "./constants";
import { loadTimelineFromFile } from "./utils-server";

export const RemotionRoot: React.FC = () => {
  const staticFiles = getStaticFiles();
  const timelines = staticFiles
    .filter((f) => f.name.endsWith("timeline.json"))
    .map((f) => f.name.split("/")[1]);

  return (
    <>
      {timelines.map((id) => (
        <Composition
          key={id}
          id={id}
          component={ShortVideo}
          fps={FPS}
          width={1080}
          height={1920}
          schema={shortVideoSchema}
          defaultProps={{ timeline: null }}
          calculateMetadata={async ({ props }) => {
            const { timeline, lengthFrames } = await loadTimelineFromFile(
              `content/${id}/timeline.json`,
            );
            return { durationInFrames: lengthFrames, props: { ...props, timeline } };
          }}
        />
      ))}
    </>
  );
};
