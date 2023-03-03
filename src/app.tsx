import * as React from "react";
import Editor, { CueSet, EditEvent } from "./editor";
import Player from "./player";

export default function App() {
  const [time, setTime] = React.useState(0.0);
  const [cues, setCues] = React.useState(new CueSet());

  function handleEdit(event: EditEvent) {
    const newCues = cues.shallowCopy();
    newCues.edit(event);
    setCues(newCues);
  }

  return (
    <div id="container">
      <Player time={time} cues={cues} onTimeUpdate={setTime} />
      <Editor time={time} cues={cues} onCueUpdate={setCues} onTimeUpdate={setTime} onEdit={handleEdit} />
    </div>
  )
}