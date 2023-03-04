import * as React from "react";
import { v4 as uuidv4 } from 'uuid';

export type EditEvent = {
  type: "move",
  edge: "start" | "end",
  from_id: string,
  to_id: string,
  to_index: number,
} | {
  type: "join",
  edge: "start" | "end",
  id: string,
} | {
  type: "split",
  id: string,
  index: number,
};

// Index mechanics:
//
// Cue 0 has words like this: ["foo", "bar", "baz"]
//
// Cue 0, index 0 is before "foo", index 1 is before "bar", index 2 is before
// "baz", index 3 is after "baz".
//
// Cue 1, index 0 is identical to cue 0, index 3.

export class Cue {
  id: string;
  startTime: number;
  endTime: number;

  words: string[];
  total_characters: number;
  characters_words: number[];
  words_characters: number[];

  public constructor(id: string, startTime: number, endTime: number, contents: string[]) {
    this.id = id;
    this.startTime = startTime;
    this.endTime = endTime;
    this.words = contents;
    this.total_characters = this.words.map((word) => word.length).reduce((a, b) => a + b);

    this.characters_words = [];
    this.words_characters = [];
    let current_word = 0;
    let chars_this_word = 0;
    let chars_all_words = 0;
    for (let i = 0; i < this.total_characters; i++) {
      chars_all_words++;
      chars_this_word++;
      this.characters_words[i] = current_word;

      if (chars_this_word >= this.words[current_word].length) {
        this.words_characters[current_word] = chars_all_words;
        current_word++;
        chars_this_word = 0;
      }
    }
  }

  public toString(): string {
    return `${this.startTime.toFixed(3)} -> ${this.endTime.toFixed(3)}: ${this.words.join(" ")}`;
  }

  public text(): string {
    return this.words.join(" ");
  }

  public isActive(time: number): boolean {
    return this.startTime <= time && this.endTime > time;
  }

  public duration(): number {
    return this.endTime - this.startTime;
  }

  public timeForIndex(index: number): number {
    if (index == 0) {
      return 0;
    }

    const character = this.words_characters[index - 1];
    return (character / this.total_characters) * this.duration() + this.startTime;
  }

  public getWords(): readonly string[] {
    return this.words
  }
}

export class CueSet {
  id: string;
  cues: Cue[];

  public constructor() {
    this.cues = [];
    this.id = uuidv4();
  }

  public shallowCopy(): CueSet {
    let rc = new CueSet();
    rc.cues = this.cues;
    return rc;
  }

  public addCue(cue: Cue) {
    this.cues.push(cue);
  }

  public getCues(): readonly Cue[] {
    return this.cues;
  }

  public getCueAt(time: number): Cue | null {
    return this.cues.filter((cue) => cue.isActive(time))[0]
  }

  public edit(event: EditEvent): boolean {
    if (event.type == "move") {
      let from_cue = this.cues.findIndex((cue) => cue.id == event.from_id);
      let to_cue = this.cues.findIndex((cue) => cue.id == event.to_id);

      if (event.edge == "start" && to_cue > from_cue) {
        return false;
      }

      if (event.edge == "end" && from_cue > to_cue) {
        return false;
      }

      console.debug(`move ${event.edge} from ${from_cue} to ${to_cue} ${event.to_index}`);

      let join_start = Math.min(from_cue, to_cue);
      let join_end = Math.max(from_cue, to_cue);

      console.debug(`  split ${to_cue} ${event.to_index}`);
      this.edit({ type: "split", id: this.cues[to_cue].id, index: event.to_index });

      // adjust join range based on inputs.
      //
      // this logic was determined empirically. I believe it has to do with
      // annoying fencepost stuff because we're always joining on "end" but the
      // move edit could go either way, but it's not very intuitive.
      if (from_cue > to_cue) {
        join_start++;
        join_end++;
      } else if (event.edge == "end" && from_cue == to_cue) {
        join_start++;
        join_end += 2;
      } else {
        join_start--;
      }

      console.debug(`  join from ${join_start} to ${join_end}`);

      for (let i = join_end - 1; i >= join_start; i--) {
        if (i < 0) continue;
        console.debug(`    join ${i} >`);
        this.edit({ type: "join", id: this.cues[i].id, edge: "end" });
      }

    } else if (event.type == "join") {
      let cue_index = this.cues.findIndex((cue) => cue.id == event.id);

      if (event.edge == "start") {
        if (cue_index == 0) {
          return false;
        }

        const contents = this.cues[cue_index - 1].words.concat(this.cues[cue_index].words);
        this.cues.splice(cue_index - 1, 2, new Cue(
          uuidv4(),
          this.cues[cue_index - 1].startTime,
          this.cues[cue_index].endTime,
          contents
        ));
      } else {
        if (cue_index >= this.cues.length - 1) {
          return false;
        }

        this.edit({
          ...event,
          edge: "start",
          id: this.cues[cue_index + 1].id,
        });
      }
    } else if (event.type == "split") {
      const cue_index = this.cues.findIndex((cue) => cue.id == event.id);

      if (event.index == 0 || event.index >= this.cues[cue_index].words.length) {
        return false;
      }

      const first = this.cues[cue_index].words.slice(0, event.index);
      const rest = this.cues[cue_index].words.slice(event.index);
      const point = this.cues[cue_index].timeForIndex(event.index);

      this.cues.splice(cue_index, 1, new Cue(
        uuidv4(),
        this.cues[cue_index].startTime,
        point,
        first
      ), new Cue(
        uuidv4(),
        point,
        this.cues[cue_index].endTime,
        rest
      ));
    }

    return true;
  }
}

function parseTimecode(tc: string): number {
  const re = /(\d+):(\d+.\d+)/;
  const found = tc.match(re);

  const minutes = Number.parseInt(found[1]);
  const seconds = Number.parseFloat(found[2]);

  return minutes * 60 + seconds;
}

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

      console.log(props.cue);

      props.onTimeUpdate(time);
    }
  }

  let within_word: number | undefined;

  if (props.cue.isActive(props.time)) {
    const nearest_character = Math.round(((props.time - props.cue.startTime) / props.cue.duration()) * props.cue.total_characters);
    within_word = props.cue.characters_words[nearest_character];
  }

  const elements = [];
  for (const i in props.cue.words) {
    const index = Number.parseInt(i);
    let separator;
    if (index < props.cue.words.length - 1) {
      if (within_word !== undefined && index == within_word) {
        separator = <span className="handle playhead">| </span>
      } else {
        separator = <span className="handle inactive-handle">| </span>;
      }
    }

    elements.push(<span
      onClick={(e) => clickInactive(e, index)}
      onDragOver={dragHandle}
      onDrop={(e) => dropHandle(e, index)}
    >{props.cue.words[index]} {separator}</span>);
  }

  return <div className={props.cue.isActive(props.time) ? "cue cue-active" : "cue"}>
    {props.cue.startTime.toFixed(3)} -&gt; {props.cue.endTime.toFixed(3)}
    <span className="handle cue-boundary" onDragStart={dragStart} draggable="true" onClick={clickStart}> | </span>
    {elements}
    <span className="handle cue-boundary" onDragStart={dragStop} draggable="true" onClick={clickStop}>|</span>
  </div>
}

function CueList(props: { time: number, cues: CueSet, onTimeUpdate: (time: number) => void, onEdit: (event: EditEvent) => void }) {
  return <div> {
    props.cues?.getCues().map((cue) => <CueElement cue={cue} time={props.time} onTimeUpdate={(time) => props.onTimeUpdate(cue.startTime + time)} onEdit={props.onEdit} />)
  }</div>;
}

export default function Editor(props: { time: number, cues: CueSet, onCueUpdate: (cues: CueSet) => void, onTimeUpdate: (time: number) => void, onEdit: (event: EditEvent) => void }) {

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

        cueList.addCue(new Cue(uuidv4(), startTC, endTC, rest.split(/\s+/)));
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
      <CueList cues={props.cues} time={props.time} onTimeUpdate={props.onTimeUpdate} onEdit={props.onEdit} />
    </div>
  )
}