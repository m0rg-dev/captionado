import { v4 as uuidv4 } from 'uuid';
import { vtt_timestamp } from './utils';

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
} | {
  type: "set_contents",
  id: string,
  contents: string[],
} | {
  type: "retime",
  id: string,
  start: number,
  end: number
} | {
  type: "gap",
  id: string,
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
    this.total_characters = this.words.map((word) => word.length).reduce((a, b) => a + b, 0);

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
  cues: Cue[];
  id: string;

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

      let join_start = Math.min(from_cue, to_cue);
      let join_end = Math.max(from_cue, to_cue);

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

      for (let i = join_end - 1; i >= join_start; i--) {
        if (i < 0) continue;
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
    } else if (event.type == "set_contents") {
      const cue_index = this.cues.findIndex((cue) => cue.id == event.id);

      this.cues.splice(cue_index, 1, new Cue(
        this.cues[cue_index].id,
        this.cues[cue_index].startTime,
        this.cues[cue_index].endTime,
        event.contents
      ));
    } else if (event.type == "retime") {
      const cue_index = this.cues.findIndex((cue) => cue.id == event.id);

      this.cues[cue_index].startTime = event.start;
      this.cues[cue_index].endTime = event.end;

      if (this.cues[cue_index - 1]) this.cues[cue_index - 1].endTime = event.start;
      if (this.cues[cue_index + 1]) this.cues[cue_index + 1].startTime = event.end;
    } else if (event.type == "gap") {
      const cue_index = this.cues.findIndex((cue) => cue.id == event.id);

      const point = Math.max(this.cues[cue_index].endTime - 1, this.cues[cue_index].duration() / 2 + this.cues[cue_index].startTime);
      this.cues.splice(cue_index + 1, 0, new Cue(
        uuidv4(),
        point,
        this.cues[cue_index].endTime,
        []
      ));

      this.cues[cue_index].endTime = point;

      // reroll the ID on the edited region so the waveform display picks it up
      this.cues[cue_index].id = uuidv4();
    }

    return true;
  }

  public export(): string {
    const chunks = ["WEBVTT"];

    for (const cue of this.cues) {
      chunks.push(`${vtt_timestamp(cue.startTime)} --> ${vtt_timestamp(cue.endTime)}\n${cue.words.join(" ")}`);
    }

    return chunks.join("\n\n");
  }
}
