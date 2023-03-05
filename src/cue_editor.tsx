import * as React from "react";
import WaveSurfer from "wavesurfer.js/dist/wavesurfer";
import RegionsPlugin, { Region, RegionParams } from "wavesurfer.js/src/plugin/regions";
import { TimeInfo } from "./app";

import { CueSet, EditEvent } from "./cue_set";

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

function Waveform(props: { url: string, cues: CueSet, time: TimeInfo, onEdit: (edit: EditEvent) => void, onTimeUpdate: (time: TimeInfo) => void }) {
  const waveformRef = React.useRef();
  const wavesurferRef = React.useRef<WaveSurfer>();
  const zoomRef = React.useRef<HTMLInputElement>();
  const [loadedURL, setLoadedURL] = React.useState<string>();
  const [lastCue, setLastCue] = React.useState<string>();

  function updateRegion(region: Region) {
    if (wavesurferRef.current) {
      props.onEdit({
        "type": "retime",
        id: region.id,
        start: wavesurferRef.current.regions.list[region.id].start,
        end: wavesurferRef.current.regions.list[region.id].end,
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
      wavesurferRef.current = wavesurfer;
    }

    if (wavesurferRef.current && props.time.maximum) {
      wavesurferRef.current.seekAndCenter(props.time.current / props.time.maximum);

      const current_cue = props.cues.getCueAt(props.time.current);

      if (lastCue != current_cue.id) {
        setLastCue(current_cue.id);
        if (wavesurferRef.current.regions.list[lastCue])
          wavesurferRef.current.regions.list[lastCue].remove();

        const params: RegionParams = {
          id: current_cue.id,
          start: current_cue.startTime,
          end: current_cue.endTime,
          color: "#00ff0055",
          drag: false,
          resize: true
        }

        if (wavesurferRef.current.regions.list[current_cue.id]) {
          wavesurferRef.current.regions.list[current_cue.id].update(params);
        } else {
          wavesurferRef.current.regions.add(params);
        }

        wavesurferRef.current.on('region-update-end', updateRegion);
      }
    }
  });

  function zoom() {
    if (wavesurferRef.current && zoomRef.current) {
      wavesurferRef.current.zoom(Number.parseInt(zoomRef.current.value));
    }
  }

  return (<>
    <div id="waveform" ref={waveformRef}></div>
    <input id="zoom" type="range" min="1" max="100" onMouseUp={zoom} ref={zoomRef}></input>
    <label htmlFor="zoom">Audio Zoom</label>
    <br />
  </>
  )
}

export default function CueEditor(props: { time: TimeInfo, cues: CueSet, onEdit: (edit: EditEvent) => void, onTimeUpdate: (time: TimeInfo) => void }) {
  const [editState, setEditState] = React.useState<EditState>({ "state": "no_cue" });
  const [audio, setAudio] = React.useState<string>();

  const current_cue = props.cues.getCueAt(props.time.current);

  function updateContents(e: React.ChangeEvent<HTMLTextAreaElement>) {
    if (current_cue !== null) {
      props.onEdit({ type: "set_contents", id: current_cue.id, contents: e.target.value.split(/\s+/) });
      setEditState({ "state": "editing", "cue_id": current_cue.id, "text": e.target.value.trim() });
    }
  }

  function loadWaveform(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.currentTarget.files === null) {
      return;
    }

    setAudio(URL.createObjectURL(e.currentTarget.files[0]));
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
  });

  // TODO less repetition

  // this can happen for stupid reasons
  if (!current_cue) {
    return (
      <div id="cue-editor">
        [no cue selected]<br />
      </div>
    );
  }

  switch (editState.state) {
    case "editing":
      return (
        <div id="cue-editor">
          Start: {current_cue.startTime}<br />
          End: {current_cue.endTime}<br />
          Contents:<br />
          <textarea id="cue-textarea" value={editState.text} onChange={updateContents}></textarea>
          <Waveform url={audio} time={props.time} cues={props.cues} onEdit={props.onEdit} onTimeUpdate={props.onTimeUpdate} />
          Audio: <input type="file" accept="audio/*" onChange={loadWaveform} />
        </div>
      );
    case "locked":
      return (<div id="cue-editor">
        Start: {current_cue.startTime}<br />
        End: {current_cue.endTime}<br />
        Contents:<br />
        <textarea id="cue-textarea" value={current_cue.getWords().join(" ")} onChange={updateContents}></textarea>
        <Waveform url={audio} time={props.time} cues={props.cues} onEdit={props.onEdit} onTimeUpdate={props.onTimeUpdate} />
        Audio: <input type="file" accept="audio/*" onChange={loadWaveform} />
      </div>);
    case "no_cue":
      return (
        <div id="cue-editor">
          [no cue selected] <br />
        </div>
      );
  }
}