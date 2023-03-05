import * as React from "react";
import CueEditor from "./cue_editor";
import { CueSet, EditEvent } from "./cue_set";
import Editor from "./editor";
import Player from "./player";

export type TimeInfo = {
  current: number,
  maximum: number,
}

export default function App() {
  const [time, setTime] = React.useState<TimeInfo>({ current: 0.0, maximum: 0.0 });
  const [cues, setCues] = React.useState(new CueSet());

  function handleEdit(event: EditEvent) {
    const newCues = cues.shallowCopy();
    newCues.edit(event);
    setCues(newCues);
  }

  function setPlayhead(current: number) {
    setTime({ current, maximum: time.maximum });
  }

  return (
    <div id="container">
      <div>
        <Player time={time} cues={cues} onTimeUpdate={setTime} />
        <CueEditor time={time} cues={cues} onEdit={handleEdit} />
      </div>
      <Editor time={time.current} cues={cues} onCueUpdate={setCues} onTimeUpdate={setPlayhead} onEdit={handleEdit} />
    </div>
  )
}