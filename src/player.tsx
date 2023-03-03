import * as React from "react";

export default function Player({ time, onTimeUpdate }: { time: number, onTimeUpdate: (newTime: number) => void }) {
  const [videoFile, setVideoFile] = React.useState(null as string);

  const videoRef = React.useRef(null as HTMLVideoElement);

  function loadVideo(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files[0];
    console.log(file);
    setVideoFile(URL.createObjectURL(file));
  }

  function updateTime() {
    onTimeUpdate(videoRef.current.currentTime);
  }

  return (
    <div>
      <div id="inputs">
        Video: <input type="file" accept="video/*" onChange={loadVideo} />
      </div>
      <video
        id="player"
        controls
        src={videoFile}
        ref={videoRef}
        onTimeUpdate={updateTime}
      ></video>
      Playhead position: <>{time}</>
    </div>
  );
}