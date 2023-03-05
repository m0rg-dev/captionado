import * as React from "react";
import { v4 as uuidv4 } from 'uuid';
import { CueSet, EditEvent, Cue } from "./cue_set";

function CueElement(props: { time: number, cue: Cue, onTimeUpdate: (relative: number) => void, onEdit: (event: EditEvent) => void }) {
  function dragHandle(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function dropHandle(e: React.DragEvent, index: number) {
    e.preventDefault();
    console.log(e);

    let event = JSON.parse(e.dataTransfer.getData("application/x-cue")) as EditEvent;
    if (event.type == "move") {
      event.to_id = props.cue.id;
      event.to_index = index;
    } else {
      throw new Error("tried to drop a non-move event " + event.type);
    }

    props.onEdit(event);
  }

  // TODO: repetition
  function clickStart(e: React.MouseEvent) {
    if (e.shiftKey) {
      props.onEdit({
        type: "join",
        edge: "start",
        id: props.cue.id
      });
    }
  }

  function clickStop(e: React.MouseEvent) {
    if (e.shiftKey) {
      props.onEdit({
        type: "join",
        edge: "end",
        id: props.cue.id
      });
    }
  }

  function dragStart(e: React.DragEvent) {
    e.dataTransfer.setData("application/x-cue", JSON.stringify({ type: "move", edge: "start", from_id: props.cue.id } as EditEvent));
  }

  function dragStop(e: React.DragEvent) {
    e.dataTransfer.setData("application/x-cue", JSON.stringify({ type: "move", edge: "end", from_id: props.cue.id } as EditEvent));
  }

  function clickInactive(e: React.MouseEvent, index: number) {
    if (e.shiftKey) {
      props.onEdit({
        type: "split",
        id: props.cue.id,
        index
      })
    } else {
      const character = props.cue.words_characters[index];
      const time = (character / props.cue.total_characters) * props.cue.duration();

      console.log(`click ${props.cue.id} ${index} ${time}`);

      props.onTimeUpdate(time);
    }
  }

  let within_word: number | undefined;

  if (props.cue.isActive(props.time)) {
    const nearest_character = Math.round(((props.time - props.cue.startTime) / props.cue.duration()) * props.cue.total_characters);
    within_word = props.cue.characters_words[nearest_character];
  }

  const elements: JSX.Element[] = [];
  for (const i in props.cue.words) {
    const index = Number.parseInt(i);
    let separator;
    if (index > 0) {
      if (within_word !== undefined && index == within_word) {
        separator = <span className="handle playhead" > | </span>
      } else {
        separator = <span className="handle inactive-handle" > | </span>;
      }
    }

    elements.push(<span
      onClick={(e) => clickInactive(e, index)}
      onDragOver={dragHandle}
      onDrop={(e) => dropHandle(e, index)
      }
    > {separator} {props.cue.words[index]} </span>);
  }

  return <tr className={props.cue.isActive(props.time) ? "cue cue-active" : "cue"}>
    <td>{props.cue.startTime.toFixed(3)}</td>
    <td>{props.cue.endTime.toFixed(3)}</td>
    <td>{(props.cue.total_characters / props.cue.duration()).toFixed(1)}</td>
    <td>
      <span className="handle cue-boundary" onDragStart={dragStart} draggable="true" onClick={clickStart} > | </span>
      {elements}
      <span className="handle cue-boundary" onDragStart={dragStop} draggable="true" onClick={clickStop} > | </span>
    </td>
  </tr>
}


function CueList(props: { time: number, cues: CueSet, onTimeUpdate: (time: number) => void, onEdit: (event: EditEvent) => void }) {
  return <table>
    <tr>
      <th>start</th>
      <th>end</th>
      <th>cps</th>
      <th>content</th>
    </tr>
    {props.cues?.getCues().map((cue) => <CueElement cue={cue} time={props.time} onTimeUpdate={(time) => props.onTimeUpdate(cue.startTime + time)} onEdit={props.onEdit} />)}
  </table>;
}

function parseTimecode(tc: string): number {
  const re = /(\d+):(\d+.\d+)/;
  const found = tc.match(re);

  if (found === null) {
    throw new Error("bad timecode");
  }

  const minutes = Number.parseInt(found[1]);
  const seconds = Number.parseFloat(found[2]);

  return minutes * 60 + seconds;
}

export default function Editor(props: { time: number, cues: CueSet, onCueUpdate: (cues: CueSet) => void, onTimeUpdate: (time: number) => void, onEdit: (event: EditEvent) => void }) {
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

    props.onCueUpdate(cueList);
  }

  return (
    <div id="editor">
      <div>
        Subtitles: <input type="file" accept="text/vtt" onChange={loadTitles} />
      </div>
      <CueList cues={props.cues} time={props.time} onTimeUpdate={props.onTimeUpdate} onEdit={props.onEdit} />
    </div>
  )
}