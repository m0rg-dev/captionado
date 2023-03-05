import * as React from "react";
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

export default function CueEditor(props: { time: number, cues: CueSet, onEdit: (edit: EditEvent) => void }) {
  const [editState, setEditState] = React.useState<EditState>({ "state": "no_cue" });

  const current_cue = props.cues.getCueAt(props.time);

  function updateContents(e: React.ChangeEvent<HTMLTextAreaElement>) {
    props.onEdit({ type: "set_contents", id: current_cue.id, contents: e.target.value.split(/\s+/) });
    setEditState({ "state": "editing", "cue_id": current_cue.id, "text": e.target.value.trim() });
  }

  React.useEffect(() => {
    if (current_cue) {
      if ((editState.state == "editing" && current_cue.id != editState.cue_id) || editState.state == "no_cue") {
        setEditState({ "state": "locked", "cue_id": current_cue.id });
      }
    } else {
      setEditState({ "state": "no_cue" });
    }
  });

  switch (editState.state) {
    case "editing":
      return (
        <div id="cue-editor">
          Start: {current_cue.startTime}<br />
          End: {current_cue.endTime}<br />
          Contents:<br />
          <textarea id="cue-textarea" value={editState.text} onChange={updateContents}></textarea>
        </div>
      );
    case "locked":
      return (<div id="cue-editor">
        Start: {current_cue.startTime}<br />
        End: {current_cue.endTime}<br />
        Contents:<br />
        <textarea id="cue-textarea" value={current_cue.getWords().join(" ")} onChange={updateContents}></textarea>
      </div>);
    case "no_cue":
      return (
        <div id="cue-editor">
          [no cue selected]
        </div>
      );
  }
}