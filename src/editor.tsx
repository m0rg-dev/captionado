import * as React from "react";

export default function Editor({ time }: { time: number }) {
  const [text, setText] = React.useState("(No Titles)");

  return (
    <div>
      <div>
        this is the title editor. It's currently {time}.
      </div>
      <div>{text}</div>
    </div>
  )
}