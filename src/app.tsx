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
    const rc = this.history[this.position];
    if (!rc) {
      throw new Error("CueSet position outside array; shouldn't happen");
    }
    return rc;
  }
}

export default function App() {
  const videoRef = React.useRef<HTMLVideoElement>(null);

  const [video, setVideo] = React.useState<string>();
  const [audio, setAudio] = React.useState<string>();
  const [time, setTime] = React.useState<TimeInfo>({ current: 0.0, maximum: 0.0 });
  const [history, setHistory] = React.useState(new History([new CueSet()], 0));
  const [savedPosition, setSavedPosition] = React.useState(0);

  const current_cue = history.tip()?.getCueAt(time.current);

  function loadVideo(event: React.ChangeEvent<HTMLInputElement>) {
    if (event.currentTarget.files === null) {
      return;
    }

    const file = event.currentTarget.files[0];
    if (file) {
      setVideo(URL.createObjectURL(file));
    }
  }

  function loadWaveform(event: React.ChangeEvent<HTMLInputElement>) {
    if (event.currentTarget.files === null) {
      return;
    }

    const file = event?.currentTarget.files[0];
    if (file) {
      setAudio(URL.createObjectURL(file));
    }
  }

  function handleEdit(event: EditEvent) {
    setHistory(h => {
      const newCues = h.tip().clone();
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
    if (!file) return;

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
      if (lines[0] && lines[0].includes(" --> ")) {
        const [startTC, endTC] = lines[0].split(" --> ").map(parseTimecode);
        if (startTC === undefined || endTC === undefined) {
          // if it contains the separator we can split it on the separator
          throw new Error("can't happen");
        }

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
    setSavedPosition(history.position);
  }

  function reflow() {
    handleEdit({ type: "reflow" });
  }

  function gap() {
    if (current_cue) {
      handleEdit({ type: "gap", id: current_cue.id });
    }
  }

  function keyboardMove(edge: "start" | "end", direction: "earlier" | "later", mode: "word" | "nudge") {
    if (!current_cue) return;

    if (mode == "word") {
      let to_cue;
      let to_index;
      if (edge == "start" && direction == "earlier") {
        to_cue = history.tip().previousCue(current_cue.id);
      } else if (edge == "end" && direction == "later") {
        to_cue = history.tip().nextCue(current_cue.id);
      } else {
        to_cue = current_cue;
      }

      if (!to_cue) return;

      if (direction == "later") {
        to_index = 1;
      } else {
        to_index = to_cue.words.length - 1;
        if (edge == "start") to_index--;
      }

      handleEdit({ type: "move", edge, from_id: current_cue.id, to_id: to_cue.id, to_index });
    } else {
      let start = current_cue.startTime;
      let end = current_cue.endTime;

      let offset = direction == "earlier" ? -0.1 : 0.1;
      if (edge == "start") start += offset;
      else end += offset;

      handleEdit({ type: "retime", id: current_cue.id, start, end });
    }
  }

  function handleKeypress(this: Window, e: KeyboardEvent) {
    // special cases: in the textbox
    if (document.activeElement?.id == "cue-textarea") {
      if (e.key == "Escape") {
        document.getElementById("cue-textarea")?.blur();
      }
      return;
    }

    // special cases: undo / redo
    if (e.key == "z" && (e.metaKey || e.ctrlKey)) {
      if (e.shiftKey) {
        redo();
      } else {
        undo();
      }
      e.preventDefault();
      return;
    }

    let shouldCancel = !((e.metaKey || e.ctrlKey));

    const index = current_cue?.indexForTime(time.current);

    switch (e.key.toLowerCase()) {
      // playback controls
      case "k":
        if (videoRef.current?.paused) {
          videoRef.current.play()
        } else {
          videoRef.current?.pause()
        }
        break;

      case "j":
        setTime({ current: history.tip().previousStart(time.current), maximum: time.maximum });
        break;

      case "l":
        setTime({ current: history.tip().nextEnd(time.current), maximum: time.maximum });
        break;

      case "u":
        if (!current_cue || index === undefined) break;

        if (index > 1) {
          setTime({ current: current_cue.timeForIndex(index - 1), maximum: time.maximum });
        } else {
          const previous_cue = history.tip().previousCue(current_cue.id);
          if (previous_cue) {
            setTime({ current: previous_cue.timeForIndex(previous_cue.words.length - 1), maximum: time.maximum });
          }
        }
        break;

      case "o":
        if (!current_cue || index === undefined) break;

        if (index < current_cue.words.length) {
          setTime({ current: current_cue.timeForIndex(index + 1), maximum: time.maximum });
        } else {
          const next_cue = history.tip().nextCue(current_cue.id);
          if (next_cue) {
            setTime({ current: next_cue.timeForIndex(1), maximum: time.maximum });
          }
        }
        break;

      case "i":
        if (!current_cue) break;

        const previous_cue = history.tip().previousCue(current_cue.id);
        if (previous_cue) {
          setTime({ current: previous_cue.startTime, maximum: time.maximum });
          // need to do this synchronously or we'll risk briefly playing from the wrong time
          if (videoRef.current) {
            videoRef.current.currentTime = previous_cue.startTime;
            videoRef.current.play();
          }
        }
        break;

      // editing (join / split)
      case "z":
        if (!current_cue) break;

        handleEdit({ type: "join", id: current_cue.id, edge: "start" });
        break;

      case "x":
        if (!current_cue) break;
        const targetIndex = current_cue.indexForTime(time.current);
        if (!targetIndex) {
          throw new Error("current time not found in current cue; shouldn't happen");
        }

        handleEdit({ type: "split", id: current_cue.id, index: targetIndex });
        break;

      case "c":
        if (!current_cue) break;

        handleEdit({ type: "join", id: current_cue.id, edge: "end" });
        break;

      // editing (move endpoints)
      case "q":
        keyboardMove("start", "earlier", e.shiftKey ? "word" : "nudge");
        break;
      case "a":
        keyboardMove("start", "later", e.shiftKey ? "word" : "nudge");
        break;
      case "e":
        keyboardMove("end", "earlier", e.shiftKey ? "word" : "nudge");
        break;
      case "d":
        keyboardMove("end", "later", e.shiftKey ? "word" : "nudge");
        break;

      // editing (enter textbox)
      case " ":
        // TODO this is bad React
        document.getElementById("cue-textarea")?.focus();
        break;

      default:
        shouldCancel = false;
        break;
    }

    if (shouldCancel) {
      e.preventDefault();
    }
  }

  function beforeUnloadListener(e: BeforeUnloadEvent) {
    e.preventDefault();
    return e.returnValue = '';
  }

  React.useEffect(() => {
    window.addEventListener('keydown', handleKeypress);
    if (history.position == savedPosition) {
      window.removeEventListener('beforeunload', beforeUnloadListener, { capture: true });
    } else {
      window.addEventListener('beforeunload', beforeUnloadListener, { capture: true });
    }

    return () => {
      window.removeEventListener('keydown', handleKeypress);
      window.removeEventListener('beforeunload', beforeUnloadListener, { capture: true });
    };
  });

  return (
    <div id="container">
      <div id="header">
        Video: <input type="file" accept="video/*" onChange={loadVideo} /><br />
        Captions: <input type="file" accept="text/vtt" onChange={loadTitles} /> <button onClick={download}>Download</button><br />
        Audio: <input type="file" accept="audio/*" onChange={loadWaveform} /><br />
      </div>
      <div id="video-container">
        <Player
          time={time}
          cues={history.tip()}
          video={video}
          onTimeUpdate={setTime}
          ref={videoRef}
        />
      </div>
      <div id="editor">
        <div>
          <button onClick={undo} disabled={history.position == 0}>Undo</button>
          <button onClick={redo} disabled={history.position >= history.history.length - 1}>Redo</button>
          |
          <button onClick={reflow}>Reflow</button>
          <button onClick={gap}>Add Gap</button><br />
        </div>
        <Editor time={time.current} cues={history.tip()} onTimeUpdate={setPlayhead} onEdit={handleEdit} />
      </div>
      <CueEditor
        time={time}
        cues={history.tip()}
        audio={audio}
        onEdit={handleEdit}
        onTimeUpdate={setTime}
      />
    </div>
  )
}