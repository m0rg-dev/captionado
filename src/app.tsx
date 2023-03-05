import * as React from "react";
import CueEditor from "./cue_editor";
import { CueSet, EditEvent } from "./cue_set";
import Editor from "./editor";
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
      <div>
        <Player time={time} cues={cues} onTimeUpdate={setTime} />
        <CueEditor time={time} cues={cues} onEdit={handleEdit} />
      </div>
      <Editor time={time} cues={cues} onCueUpdate={setCues} onTimeUpdate={setTime} onEdit={handleEdit} />
    </div>
  )
}