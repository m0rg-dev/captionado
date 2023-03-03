import * as React from "react";
import { v4 as uuidv4 } from 'uuid';

export type EditEvent = {
  edge: string,
  from_id: string,
  to_id: string,
  to_index: number,
};

export class Cue {
  id: string;
  startTime: number;
  endTime: number;

  words: string[];
  total_characters: number;
  characters_words: number[];
  words_characters: number[];

  public constructor(id: string, startTime: number, endTime: number, contents: string) {
    this.id = id;
    this.startTime = startTime;
    this.endTime = endTime;
    this.words = contents.split(/\s/);
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
        this.words_characters[current_word] = chars_all_words - 1;
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
    const character = this.words_characters[index];
    return (character / this.total_characters) * this.duration();
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

  public edit(event: EditEvent) {
    console.log(event);

    let from_cue = this.cues.findIndex((cue) => cue.id == event.from_id);
    let to_cue = this.cues.findIndex((cue) => cue.id == event.to_id);

    const to_index = event.to_index + 1; // TODO
    let from_index;

    if (event.edge == "start") {
      if (to_cue > from_cue) {
        console.warn("attempted to move cue start before cue end!");
      }
      from_index = 0;
    } else if (event.edge == "stop") {
      if (to_cue < from_cue) {
        console.warn("attempted to move cue end before cue start!");
        return;
      }
      from_index = this.cues[from_cue].words.length - 1;
    } else {
      throw new Error(`unknown event type ${event.edge}`);
    }

    console.log(`from: cue ${from_cue} index ${from_index}`);
    console.log(`to: cue ${to_cue} index ${to_index}`);

    // 4 cases: end forward, end backward, start forward, start backward 
    // let's just handle them separately for now and combine where possible
    if (event.edge == "start") {
      if (from_cue == to_cue) {
        // We're moving the start to somewhere within the same cue. That means
        // this is the "start forward" case - we know it's forward, because if
        // it wasn't, we'd have moved into a different cue. We also can't move
        // the start point past the end point, so this is the only "start
        // forward" edit possible.

        // In this case, what we'll need to do is take everything from the start
        // of the cue through to `to_index` and move it to the previous cue.

        const add_to_previous = this.cues[from_cue].words.slice(0, to_index);
        const keep = this.cues[from_cue].words.slice(to_index);

        console.log(add_to_previous);
        console.log(keep);

        const point = this.cues[from_cue].timeForIndex(to_index) + this.cues[from_cue].startTime;

        // Also, if there's *no* previous cue, we'll have to add one.
        if (from_cue == 0) {
          this.cues.unshift(new Cue(uuidv4(), this.cues[from_cue].startTime, point, add_to_previous.join(" ")));
          // That will move our indices around, so we'll adjust to_cue.
          to_cue++;
        } else {
          this.cues[from_cue - 1] = new Cue(
            uuidv4(),
            this.cues[from_cue - 1].startTime,
            point,
            this.cues[from_cue - 1].words.concat(...add_to_previous).join(" ")
          );
        }

        // And now we can replace this cue, which will always exist. We make
        // sure to use `to_cue` here since it may have changed if this was cue
        // 0.
        this.cues[to_cue] = new Cue(uuidv4(), point, this.cues[to_cue].endTime, keep.join(" "));
      } else {
        // We're moving the start to somewhere in a different cue. Since we
        // error out if we're trying to move the start to a later cue, we know
        // this is going to an earlier cue - the "start backward" case.

        // To handle this, we need to split everything from `to_index` forwards
        // off and add it to the start of `from_cue`. Also, if `to_cue` isn't
        // the cue immediately before `from_cue`, we'll have to coalesce some
        // complete cues into `from_cue` as well.

        // First, we'll get a list of all the cues that will have text removed:

        const removed_cues = this.cues.slice(to_cue, from_cue);

        console.log(removed_cues);

        // The first cue will be partially modified, and the rest will be
        // dropped entirely. Since we'll be indexing from the first cue, we can
        // actually combine the contents of all the cues now and deal with it
        // like if `to_cue` was just really long.

        const preceding_contents = removed_cues.flatMap((cue) => cue.words);
        const first = preceding_contents.slice(0, to_index);
        const rest = preceding_contents.slice(to_index);

        // We'll also adjust from_cue to match. We'll be putting one cue back in,
        // so we'll decrease from_cue by removed_cues.length - 1.

        from_cue -= removed_cues.length - 1;

        const point = this.cues[to_cue].timeForIndex(to_index) + this.cues[from_cue].startTime;

        this.cues.splice(to_cue, removed_cues.length, new Cue(
          uuidv4(),
          this.cues[to_cue].startTime,
          point,
          first.join(" ")
        ));

        this.cues[from_cue] = new Cue(
          uuidv4(),
          point,
          this.cues[from_cue].endTime,
          rest.concat(this.cues[from_cue].words).join(" ")
        );
      }
    } else {
      // Well, this is really just doing the same thing as the same motion on
      // the next cue's "start" would do.

      // Let's just do that!
      this.edit({
        ...event,
        edge: "start",
        from_id: this.cues[from_cue].id,
      });
    }
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
    event.to_id = props.cue.id;
    event.to_index = index;

    props.onEdit(event);
  }

  function dragStart(e: React.DragEvent) {
    e.dataTransfer.setData("application/x-cue", JSON.stringify({ edge: "start", from_id: props.cue.id } as EditEvent));
  }

  function dragStop(e: React.DragEvent) {
    e.dataTransfer.setData("application/x-cue", JSON.stringify({ edge: "stop", from_id: props.cue.id } as EditEvent));
  }

  function movePlayhead(index: number) {
    const character = props.cue.words_characters[index];
    const time = (character / props.cue.total_characters) * props.cue.duration();

    console.log(props.cue);

    props.onTimeUpdate(time);
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
      onClick={() => movePlayhead(index)}
      onDragOver={dragHandle}
      onDrop={(e) => dropHandle(e, index)}
    >{props.cue.words[index]} {separator}</span>);
  }

  return <div className={props.cue.isActive(props.time) ? "cue cue-active" : "cue"}>
    {props.cue.startTime.toFixed(3)} -&gt; {props.cue.endTime.toFixed(3)}
    <span className="handle cue-boundary" onDragStart={dragStart} draggable="true"> | </span>
    {elements}
    <span className="handle cue-boundary" onDragStart={dragStop} draggable="true">|</span>
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

        cueList.addCue(new Cue(uuidv4(), startTC, endTC, rest));
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