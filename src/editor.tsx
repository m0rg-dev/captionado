import * as React from "react";

export class Cue {
  startTime: number;
  endTime: number;
  contents: string;

  public constructor(startTime: number, endTime: number, contents: string) {
    this.startTime = startTime;
    this.endTime = endTime;
    this.contents = contents;
  }

  public toString(): string {
    return `${this.startTime.toFixed(3)} -> ${this.endTime.toFixed(3)}: ${this.contents}`;
  }

  public text(): string {
    return this.contents;
  }
}

export class CueSet {
  cues: Cue[];

  public constructor() {
    this.cues = [];
  }

  public addCue(cue: Cue) {
    this.cues.push(cue);
  }

  public getCues(): readonly Cue[] {
    return Object.freeze(this.cues)
  }

  public getCueAt(time: number): Cue | null {
    return this.cues.filter((cue) => cue.startTime <= time && cue.endTime > time)[0]
  }
}

function parseTimecode(tc: string): number {
  const re = /(\d+):(\d+.\d+)/;
  const found = tc.match(re);

  const minutes = Number.parseInt(found[1]);
  const seconds = Number.parseFloat(found[2]);

  return minutes * 60 + seconds;
}

function CueList(props: { cues: CueSet }) {
  return <div> {
    props.cues?.getCues().map((cue) => <div>{cue.toString()}</div>)
  }</div>;
}

export default function Editor(props: { time: number, cues: CueSet, onCueUpdate: (cues: CueSet) => void }) {

  async function loadTitles(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files[0];

    const reader = new FileReader();
    const contents: string = await new Promise((res, rej) => {
      reader.addEventListener('load', (event) => {
        if (typeof event.target.result !== "string") {
          throw new Error("can't happen!");
        }

        res(event.target.result)
      });
      reader.readAsText(file);
    });

    // Welcome to The Worst VTT Parser Ever!
    const cueList = new CueSet();

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

        console.log(`start: ${startTC} end: ${endTC} cue: ${rest}`);

        cueList.addCue(new Cue(startTC, endTC, rest));
      } else {
        // TODO: bad chunk
      }
    }

    props.onCueUpdate(cueList);
  }

  return (
    <div>
      <div>
        Subtitles: <input type="file" accept="text/vtt" onChange={loadTitles} />
      </div>
      <CueList cues={props.cues} />
    </div>
  )
}