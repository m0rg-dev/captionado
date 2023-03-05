import * as React from "react";
import CueEditor from "./cue_editor";
import { Cue, CueSet, EditEvent } from "./cue_set";
import Editor from "./editor";
import Player from "./player";
import { v4 as uuidv4 } from 'uuid';
import { parseTimecode } from "./utils";

export type TimeInfo = {
  current: number,
  maximum: number,
}

class History {
  history: CueSet[];
  position: number;

  constructor(history: CueSet[], position = 0) {
    this.history = history;
    this.position = position;
  }

  insert(cue: CueSet): History {
    return new History(this.history.slice(0, this.position + 1).concat(cue), this.position + 1);
  }

  undo(): History {
    if (this.position > 0) {
      return new History(this.history, this.position - 1);
    } else {
      return this;
    }
  }

  redo(): History {
    if (this.position < this.history.length - 1) {
      return new History(this.history, this.position + 1);
    } else {
      return this;
    }
  }

  tip(): CueSet {
    return this.history[this.position];
  }
}

export default function App() {
  const [video, setVideo] = React.useState<string>();
  const [audio, setAudio] = React.useState<string>();
  const [time, setTime] = React.useState<TimeInfo>({ current: 0.0, maximum: 0.0 });
  const [history, setHistory] = React.useState(new History([new CueSet()], 0));

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
    setHistory(h => {
      const newCues = history.tip().clone();
      const success = newCues.edit(event);

      // don't create undo log events for failed edits!
      if (success) {
        return h.insert(newCues);
      } else {
        return h;
      }
    });

  }

  function undo() {
    setHistory(h => h.undo());
  }

  function redo() {
    setHistory(h => h.redo());
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

        if (lastEnd != undefined && startTC != lastEnd) {
          cueList.addCue(new Cue(uuidv4(), lastEnd, startTC, []));
        }

        lastEnd = endTC;

        cueList.addCue(new Cue(uuidv4(), startTC, endTC, rest.split(/\s+/)));
      } else {
        // TODO: bad chunk
      }
    }

    setHistory(h => h.insert(cueList));
  }

  function download() {
    const blob = new Blob([history.tip().export()], { type: 'text/vtt' });
    const elem = document.createElement('a');
    elem.href = URL.createObjectURL(blob);
    elem.download = "";
    document.body.appendChild(elem);
    elem.click();
    document.body.removeChild(elem);
  }

  function reflow() {
    handleEdit({ type: "reflow" });
  }

  return (
    <div id="container">
      <div>
        <Player
          time={time}
          cues={history.tip()}
          video={video}
          onTimeUpdate={setTime}
        />
        <CueEditor
          time={time}
          cues={history.tip()}
          audio={audio}
          onEdit={handleEdit}
          onTimeUpdate={setTime}
        />
      </div>
      <div>
        <div id="inputs">
          Video: <input type="file" accept="video/*" onChange={loadVideo} /><br />
          Captions: <input type="file" accept="text/vtt" onChange={loadTitles} /> <button onClick={download}>Download</button><br />
          Audio: <input type="file" accept="audio/*" onChange={loadWaveform} /><br />
          <button onClick={undo} disabled={history.position == 0}>Undo</button>
          <button onClick={redo} disabled={history.position >= history.history.length - 1}>Redo</button>
          |
          <button onClick={reflow}>Reflow</button>
        </div>
        <Editor time={time.current} cues={history.tip()} onTimeUpdate={setPlayhead} onEdit={handleEdit} />
      </div>
    </div>
  )
}