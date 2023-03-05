import * as React from "react";
import { TimeInfo } from "./app";
import { CueSet } from "./cue_set";

export default function Player(props: {
  time: TimeInfo,
  cues: CueSet,
  video: string,
  onTimeUpdate: (time: TimeInfo) => void,
}) {
  const videoRef = React.useRef<HTMLVideoElement>();
  const lastTitlesGen = React.useRef<string>();
  const titlesRef = React.useRef<string>();

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

    if (props.cues.id != lastTitlesGen.current) {
      if (!videoRef.current.textTracks[0]) {
        const track = videoRef.current.addTextTrack("captions", "Captions");
        track.mode = "showing";
      }

      for (let i = videoRef.current.textTracks[0].cues.length - 1; i >= 0; i--) {
        videoRef.current.textTracks[0].removeCue(videoRef.current.textTracks[0].cues[i]);
      }

      for (const cue of props.cues.cues) {
        videoRef.current.textTracks[0].addCue(new VTTCue(cue.startTime, cue.endTime, cue.text()));
      }

      lastTitlesGen.current = props.cues.id;
    }
  })

  return (
    <div>
      <video
        id="video"
        controls
        src={props.video}
        ref={videoRef}
        onTimeUpdate={updateTime}
        onCanPlay={updateMaxTime}
      >
      </video>
      <div>
        Current cue: {props.cues.getCueAt(props.time.current)?.toString()}
      </div>
      Playhead position: <>{props.time.current}</>
    </div>
  );
}