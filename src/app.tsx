import * as React from "react";
import Editor from "./editor";
import Player from "./player";

export default function App() {
  const [time, setTime] = React.useState(0.0);

  return (
    <div id="container">
      <Player time={time} onTimeUpdate={setTime} />
      <Editor time={time} />
    </div>
  )
}