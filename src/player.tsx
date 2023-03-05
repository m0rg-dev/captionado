import * as React from "react";
import { TimeInfo } from "./app";
import { CueSet } from "./cue_set";

export default function Player(props: {
  time: TimeInfo,
  cues: CueSet,
  onTimeUpdate: (time: TimeInfo) => void,
}) {
  const [videoFile, setVideoFile] = React.useState<string | undefined>(undefined);

  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  function loadVideo(event: React.ChangeEvent<HTMLInputElement>) {
    if (event.currentTarget.files === null) {
      return;
    }

    const file = event.currentTarget.files[0];
    setVideoFile(URL.createObjectURL(file));
  }

  function updateTime() {
    console.log(`updateTime ${videoRef.current?.currentTime}`);
    if (videoRef.current) {
      props.onTimeUpdate({ current: videoRef.current.currentTime, maximum: props.time.maximum });
    }
  }

  function updateMaxTime() {
    if (videoRef.current) {
      props.onTimeUpdate({ current: videoRef.current.currentTime, maximum: videoRef.current.duration });
    }
  }

  React.useEffect(() => {
    if (videoRef.current && Math.abs(props.time.current - videoRef.current.currentTime) > 0.1) {
      console.log(`seek ${props.time} ${videoRef.current.currentTime}`);
      videoRef.current.currentTime = props.time.current;
    }
  })

  return (
    <div>
      <div id="inputs">
        Video: <input type="file" accept="video/*" onChange={loadVideo} />
      </div>
      <div id="video-player">
        <video
          id="video"
          controls
          src={videoFile}
          ref={videoRef}
          onTimeUpdate={updateTime}
          onCanPlay={updateMaxTime}
        ></video>
        <div id="caption">
          <div id="caption-inner">
            {props.cues.getCueAt(props.time.current)?.text()}
          </div>
        </div>
      </div>
      <div>
        Current cue: {props.cues.getCueAt(props.time.current)?.toString()}
      </div>
      Playhead position: <>{props.time.current}</>
    </div>
  );
}