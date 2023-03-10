import * as React from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin, { Region, RegionParams } from "wavesurfer.js/src/plugin/regions";
import { TimeInfo } from "./app";

import { CueSet, EditEvent } from "./cue_set";
import { vttTimestamp } from "./utils";

type EditState = {
  "state": "locked",
  "cue_id": string
} | {
  "state": "editing",
  "text": string,
  "cue_id": string
} | {
  "state": "no_cue",
};

type WaveformState = {
  "state": "not_loaded"
} | {
  "state": "loading",
  "progress": number,
} | {
  "state": "loaded"
};

// TODO set things up so I can mock / otherwise test wavesurfer.js
// until then we're going to leave it alone
/* c8 ignore start */
function Waveform(props: { url: string | undefined, cues: CueSet, time: TimeInfo, onEdit: (edit: EditEvent) => void, onTimeUpdate: (time: TimeInfo) => void }) {
  const waveformRef = React.useRef<HTMLDivElement>(null);
  const wavesurferRef = React.useRef<WaveSurfer>();
  const zoomRef = React.useRef<HTMLInputElement>(null);
  const [loadedURL, setLoadedURL] = React.useState<string>();
  const [lastCue, setLastCue] = React.useState<string>("");
  const [progress, setProgress] = React.useState<WaveformState>({ state: "not_loaded" });

  function updateRegion(region: Region) {
    if (wavesurferRef.current) {
      props.onEdit({
        "type": "retime",
        id: region.id,
        start: region.start,
        end: region.end,
      })
    }
  }

  React.useEffect(() => {
    // wavesurfer has TOO MUCH STATE dang it
    if (waveformRef.current && props.url && props.url != loadedURL) {
      const wavesurfer = WaveSurfer.create({
        container: waveformRef.current,
        normalize: true,
      });

      wavesurfer.zoom(50);

      wavesurfer.addPlugin(RegionsPlugin.create({
        dragSelection: false
      }));

      wavesurfer.load(props.url);
      setLoadedURL(props.url);
      wavesurfer.on('region-update-end', updateRegion);
      wavesurfer.on('loading', (progress: number) => {
        setProgress({ state: "loading", progress });
      });
      wavesurfer.on('ready', () => {
        setProgress({ state: "loaded" });
      });
      wavesurferRef.current = wavesurfer;
    }

    if (wavesurferRef.current && props.time.maximum) {
      wavesurferRef.current.seekAndCenter(props.time.current / props.time.maximum);

      const current_cue = props.cues.getCueAt(props.time.current);

      if (current_cue && lastCue != current_cue.id) {
        setLastCue(current_cue.id);
        wavesurferRef.current.regions.list[lastCue]?.remove();

        const params: RegionParams = {
          id: current_cue.id,
          start: current_cue.startTime,
          end: current_cue.endTime,
          color: "#00ff0055",
          drag: false,
          resize: true
        }

        if (wavesurferRef.current.regions.list[current_cue.id]) {
          wavesurferRef.current.regions.list[current_cue.id]?.update(params);
        } else {
          wavesurferRef.current.regions.add(params);
        }
      }
    }
  });

  function zoom() {
    if (wavesurferRef.current && zoomRef.current) {
      wavesurferRef.current.zoom(Number.parseInt(zoomRef.current.value));
    }
  }


  let audio_progress;
  if (progress.state == "loading") {
    if (progress.progress < 100) {
      audio_progress = <div id="audio-status">Loading audio: {progress.progress}%</div>
    } else {
      audio_progress = <div id="audio-status">Loading audio: Rendering waveform...</div>
    }
  }

  return (<>
    <div id="waveform" ref={waveformRef}></div>
    {audio_progress}
    <input id="zoom" type="range" min="1" max="100" onMouseUp={zoom} ref={zoomRef}></input>
    <label htmlFor="zoom">Audio Zoom</label>
    <br />
  </>
  )
}
/* c8 ignore stop */

export default function CueEditor(props: { time: TimeInfo, cues: CueSet, audio: string | undefined, onEdit: (edit: EditEvent) => void, onTimeUpdate: (time: TimeInfo) => void }) {
  const [editState, setEditState] = React.useState<EditState>({ "state": "no_cue" });

  const current_cue = props.cues.getCueAt(props.time.current);

  function updateContents(e: React.ChangeEvent<HTMLTextAreaElement>) {
    if (current_cue !== undefined) {
      props.onEdit({ type: "set_contents", id: current_cue.id, contents: e.target.value.trim().split(/\s+/) });
      setEditState({ "state": "editing", "cue_id": current_cue.id, "text": e.target.value });
    }
  }

  React.useEffect(() => {
    if (current_cue) {
      if ((editState.state == "editing" && current_cue.id != editState.cue_id)
        || (editState.state == "locked" && current_cue.id != editState.cue_id)
        || editState.state == "no_cue") {
        setEditState({ "state": "locked", "cue_id": current_cue.id });
      }
    } else {
      setEditState({ "state": "no_cue" });
    }
  }, [current_cue]);

  if (!current_cue) {
    return (
      <div id="cue-editor" aria-label="cue editor">
        [no cue selected]<br />
      </div>
    );
  }

  let textarea;

  switch (editState.state) {
    case "editing":
      textarea = <textarea id="cue-textarea" value={editState.text} onChange={updateContents}></textarea>;
      break;
    case "locked":
      textarea = <textarea id="cue-textarea" value={current_cue.text()} onChange={updateContents}></textarea>;
      break;
    case "no_cue":
      return (
        <div id="cue-editor" aria-label="cue editor">
          [no cue selected]<br />
        </div>
      );
  }

  return (<div id="cue-editor" aria-label="cue editor">
    <div>
      Timing: {vttTimestamp(current_cue.startTime)} --&gt; {vttTimestamp(current_cue.endTime)}<br />
      Contents:<br />
      {textarea}
      <Waveform url={props.audio} time={props.time} cues={props.cues} onEdit={props.onEdit} onTimeUpdate={props.onTimeUpdate} />
    </div>
  </div>);
}