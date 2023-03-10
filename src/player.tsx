import * as React from "react";
import { TimeInfo } from "./app";
import { CueSet } from "./cue_set";

const Player = React.forwardRef(function Player(props: {
  time: TimeInfo,
  cues: CueSet,
  video: string | undefined,
  onTimeUpdate: (time: TimeInfo) => void,
}, videoRef: React.Ref<HTMLVideoElement>) {
  const lastTitlesGen = React.useRef<string>();

  // TODO handle callback refs here (this whole section is kind of suspect)
  function updateTime() {
    if (typeof videoRef == 'object' && videoRef?.current) {
      props.onTimeUpdate({ current: videoRef.current.currentTime, maximum: props.time.maximum });
    }
  }

  function updateMaxTime() {
    if (typeof videoRef == 'object' && videoRef?.current) {
      props.onTimeUpdate({ current: videoRef.current.currentTime, maximum: videoRef.current.duration });
    }
  }

  React.useEffect(() => {
    if (typeof videoRef == 'object' && videoRef?.current) {
      if (Math.abs(props.time.current - videoRef.current.currentTime) > 0.1) {
        videoRef.current.currentTime = props.time.current;
      }

      if (props.cues.id != lastTitlesGen.current) {
        let track = videoRef.current.textTracks[0];

        if (!track) {
          track = videoRef.current.addTextTrack("captions", "Captions");
          track.mode = "showing";
        }

        if (track.cues) {
          for (let i = track.cues.length - 1; i >= 0; i--) {
            const cue = track.cues[i];
            if (cue) track.removeCue(cue);
          }
        }

        for (const cue of props.cues.cues) {
          track.addCue(new VTTCue(cue.startTime, cue.endTime, cue.text()));
        }

        lastTitlesGen.current = props.cues.id;
      }
    }
  })

  return (
    <video
      id="video"
      controls
      src={props.video}
      ref={videoRef}
      onTimeUpdate={updateTime}
      onCanPlay={updateMaxTime}
    />
  );
});

export default Player;
