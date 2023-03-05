import * as React from "react";
import { CueSet, EditEvent, Cue } from "./cue_set";

function CueElement(props: { time: number, cue: Cue, onTimeUpdate: (relative: number) => void, onEdit: (event: EditEvent) => void }) {
  function dragHandle(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function dropHandle(e: React.DragEvent, index: number) {
    e.preventDefault();

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

export default function Editor(props: { time: number, cues: CueSet, onCueUpdate: (cues: CueSet) => void, onTimeUpdate: (time: number) => void, onEdit: (event: EditEvent) => void }) {
  return (
    <div id="editor">
      <div>
      </div>
      <CueList cues={props.cues} time={props.time} onTimeUpdate={props.onTimeUpdate} onEdit={props.onEdit} />
    </div>
  )
}