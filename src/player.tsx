import * as React from "react";
import { CueSet } from "./cue_set";

export default function Player(props: {
  time: number,
  cues: CueSet,
  onTimeUpdate: (newTime: number) => void,
}) {
  const [videoFile, setVideoFile] = React.useState(null as string);

  const videoRef = React.useRef(null as HTMLVideoElement);

  function loadVideo(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files[0];
    setVideoFile(URL.createObjectURL(file));
  }

  function updateTime() {
    console.log(`updateTime ${videoRef.current.currentTime}`);
    props.onTimeUpdate(videoRef.current.currentTime);
  }

  React.useEffect(() => {
    if (Math.abs(props.time - videoRef.current.currentTime) > 0.1) {
      console.log(`seek ${props.time} ${videoRef.current.currentTime}`);
      videoRef.current.currentTime = props.time;
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
        ></video>
        <div id="caption">
          <div id="caption-inner">
            {props.cues.getCueAt(props.time)?.text()}
          </div>
        </div>
      </div>
      <div>
        Current cue: {props.cues.getCueAt(props.time)?.toString()}
      </div>
      Playhead position: <>{props.time}</>
    </div>
  );
}