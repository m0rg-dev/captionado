import * as React from "react";
import CueEditor from "./cue_editor";
import { Cue, CueSet, EditEvent } from "./cue_set";
import Editor from "./editor";
import Player from "./player";
import { v4 as uuidv4 } from 'uuid';

export type TimeInfo = {
  current: number,
  maximum: number,
}

function parseTimecode(tc: string): number {
  const re = /(?:(\d+):)?(\d+):(\d+.\d+)/;
  const found = tc.match(re);

  if (found === null) {
    throw new Error("bad timecode");
  }

  const hours = Number.parseInt(found[1] || "0");
  const minutes = Number.parseInt(found[2]);
  const seconds = Number.parseFloat(found[3]);

  return hours * 3600 + minutes * 60 + seconds;
}

export default function App() {
  const [video, setVideo] = React.useState<string>();
  const [audio, setAudio] = React.useState<string>();
  const [time, setTime] = React.useState<TimeInfo>({ current: 0.0, maximum: 0.0 });
  const [cues, setCues] = React.useState(new CueSet());


  function loadVideo(event: React.ChangeEvent<HTMLInputElement>) {
    if (event.currentTarget.files === null) {
      return;
    }

    const file = event.currentTarget.files[0];
    setVideo(URL.createObjectURL(file));
  }

  function loadWaveform(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.currentTarget.files === null) {
      return;
    }

    setAudio(URL.createObjectURL(e.currentTarget.files[0]));
  }

  function handleEdit(event: EditEvent) {
    const newCues = cues.shallowCopy();
    newCues.edit(event);
    setCues(newCues);
  }

  function setPlayhead(current: number) {
    setTime({ current, maximum: time.maximum });
  }

  async function loadTitles(event: React.ChangeEvent<HTMLInputElement>) {
    if (event.currentTarget.files === null) return;

    const file = event.currentTarget.files[0];

    const reader = new FileReader();
    const contents: string = await new Promise((res, rej) => {
      reader.addEventListener('load', (event) => {
        if (typeof event.target?.result !== "string") {
          throw new Error("can't happen!");
        }

        res(event.target.result)
      });
      reader.readAsText(file);
    });

    // Welcome to The Worst VTT Parser Ever!
    const cueList = new CueSet();

    let lastEnd: number | null = null;

    for (const chunk of contents.split("\n\n")) {
      if (chunk == "WEBVTT") {
        // nop, magic number
        continue;
      }

      const lines = chunk.split("\n")
      if (lines[0].includes(" --> ")) {
        const [startTC, endTC] = lines[0].split(" --> ").map(parseTimecode);
        lines.shift();
        const rest = lines.join("\n");

        console.log(`start: ${startTC} end: ${endTC} lastEnd: ${lastEnd} cue: ${rest}`);

        if (lastEnd != undefined && startTC != lastEnd) {
          console.log("inserting break");
          cueList.addCue(new Cue(uuidv4(), lastEnd, startTC, []));
        }

        lastEnd = endTC;

        cueList.addCue(new Cue(uuidv4(), startTC, endTC, rest.split(/\s+/)));
      } else {
        // TODO: bad chunk
      }
    }

    setCues(cueList);
  }

  function download() {
    const blob = new Blob([cues.export()], { type: 'text/vtt' });
    const elem = document.createElement('a');
    elem.href = URL.createObjectURL(blob);
    elem.download = "";
    document.body.appendChild(elem);
    elem.click();
    document.body.removeChild(elem);
  }

  return (
    <div id="container">
      <div>
        <Player
          time={time}
          cues={cues}
          video={video}
          onTimeUpdate={setTime}
        />
        <CueEditor
          time={time}
          cues={cues}
          audio={audio}
          onEdit={handleEdit}
          onTimeUpdate={setTime}
        />
      </div>
      <div>
        <div id="inputs">
          Video: <input type="file" accept="video/*" onChange={loadVideo} /><br />
          Captions: <input type="file" accept="text/vtt" onChange={loadTitles} /> <button onClick={download}>Download</button><br />
          Audio: <input type="file" accept="audio/*" onChange={loadWaveform} />
        </div>
        <Editor time={time.current} cues={cues} onCueUpdate={setCues} onTimeUpdate={setPlayhead} onEdit={handleEdit} />
      </div>
    </div>
  )
}