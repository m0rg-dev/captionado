import { v4 as uuidv4 } from 'uuid';
import { vttTimestamp } from './utils';

const REFLOW_MIN_SENTENCE_LENGTH = 5;

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
} | {
  type: "reflow"
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

  readonly words: string[];
  readonly total_characters: number;
  readonly characters_words: number[];
  readonly words_characters: number[];

  public constructor(id: string, startTime: number, endTime: number, contents: string[]) {
    this.id = id;
    this.startTime = startTime;
    this.endTime = endTime;
    this.words = contents;
    this.total_characters = this.words.map((word) => word.length).reduce((a, b) => a + b, 0);

    this.characters_words = [];
    this.words_characters = [];
    let current_word_index = 0;
    let chars_this_word = 0;
    let chars_all_words = 0;
    for (let i = 0; i < this.total_characters; i++) {
      chars_all_words++;
      chars_this_word++;
      this.characters_words[i] = current_word_index;

      const current_word = this.words[current_word_index];

      /* c8 ignore next 3 */
      if (current_word === undefined) {
        throw new Error("ran off the end of this.words in cue constructor; shouldn't happen");
      }

      if (chars_this_word >= current_word.length) {
        this.words_characters[current_word_index] = chars_all_words;
        current_word_index++;
        chars_this_word = 0;
      }
    }
    this.characters_words[this.total_characters] = this.words.length;
  }

  public clone(): Cue {
    // TODO could we optimize here by copying the generated fields?
    return new Cue(this.id, this.startTime, this.endTime, [...this.words]);
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
    if (index <= 0) {
      return this.startTime;
    }

    const character = this.words_characters[index - 1];
    if (character === undefined) {
      // went off the end
      return this.endTime;
    }

    return (character / this.total_characters) * this.duration() + this.startTime;
  }

  public indexForTime(time: number): number | undefined {
    const nearest_character = Math.round(((time - this.startTime) / this.duration()) * this.total_characters);
    return this.characters_words[nearest_character];
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
    const rc = new CueSet();
    rc.cues = this.cues;
    return rc;
  }

  public clone(): CueSet {
    const rc = new CueSet();
    for (const cue of this.cues) {
      rc.addCue(cue.clone());
    }

    return rc;
  }

  public addCue(cue: Cue) {
    this.cues.push(cue);
  }

  public getCues(): readonly Cue[] {
    return this.cues;
  }

  public getCueAt(time: number): Cue | undefined {
    return this.cues.filter((cue) => cue.isActive(time))[0]
  }

  public edit(event: EditEvent, _keep_second_id_hack = false): boolean {
    if (event.type == "move") {
      const from_cue_index = this.cues.findIndex((cue) => cue.id == event.from_id);
      const to_cue_index = this.cues.findIndex((cue) => cue.id == event.to_id);

      const to_cue = this.cues[to_cue_index] || (() => { throw new Error("can't happen") })();

      if (event.edge == "start" && to_cue_index > from_cue_index) {
        return false;
      }

      if (event.edge == "start" && event.to_index >= to_cue.words.length) {
        return false;
      }

      if (event.edge == "end" && from_cue_index > to_cue_index) {
        return false;
      }

      if (event.edge == "end" && event.to_index == 0) {
        return false;
      }

      let join_start = Math.min(from_cue_index, to_cue_index);
      let join_end = Math.max(from_cue_index, to_cue_index);

      this.edit({ type: "split", id: to_cue.id, index: event.to_index });

      // adjust join range based on inputs.
      //
      // this logic was determined empirically. I believe it has to do with
      // annoying fencepost stuff because we're always joining on "end" but the
      // move edit could go either way, but it's not very intuitive.

      if (from_cue_index > to_cue_index) {
        // start backward
        join_start++;
        join_end++;
      } else if (from_cue_index < to_cue_index) {
        // end forward
      } else if (event.edge == "end") {
        // end backward
        join_start++;
        join_end += 2;
      } else {
        // start forward
        join_start--;
      }

      for (let i = join_end - 1; i >= join_start; i--) {
        const this_cue = this.cues[i];
        if (this_cue === undefined) continue;
        this.edit({ type: "join", id: this_cue.id, edge: "end" });
      }

    } else if (event.type == "join") {
      const cue_index = this.cues.findIndex((cue) => cue.id == event.id);
      const this_cue = this.cues[cue_index] || (() => { throw new Error("can't happen") })();

      if (event.edge == "start") {
        const previous_cue = this.cues[cue_index - 1];
        if (!previous_cue) {
          return false;
        }

        const contents = previous_cue.words.concat(this_cue.words);
        this.cues.splice(cue_index - 1, 2, new Cue(
          _keep_second_id_hack ? this_cue.id : uuidv4(),
          previous_cue.startTime,
          this_cue.endTime,
          contents
        ));
      } else {
        const next_cue = this.cues[cue_index + 1];
        if (!next_cue) {
          return false;
        }


        this.edit({
          ...event,
          edge: "start",
          id: next_cue.id,
        }, _keep_second_id_hack);
      }
    } else if (event.type == "split") {
      const cue_index = this.cues.findIndex((cue) => cue.id == event.id);
      const this_cue = this.cues[cue_index] || (() => { throw new Error("can't happen") })();

      if (event.index == 0 || event.index >= this_cue.words.length) {
        return false;
      }

      const first = this_cue.words.slice(0, event.index);
      const rest = this_cue.words.slice(event.index);
      const point = this_cue.timeForIndex(event.index);

      this.cues.splice(cue_index, 1, new Cue(
        uuidv4(),
        this_cue.startTime,
        point,
        first
      ), new Cue(
        _keep_second_id_hack ? event.id : uuidv4(),
        point,
        this_cue.endTime,
        rest
      ));
    } else if (event.type == "set_contents") {
      const cue_index = this.cues.findIndex((cue) => cue.id == event.id);
      const this_cue = this.cues[cue_index] || (() => { throw new Error("can't happen") })();

      this.cues.splice(cue_index, 1, new Cue(
        this_cue.id,
        this_cue.startTime,
        this_cue.endTime,
        event.contents
      ));
    } else if (event.type == "retime") {
      const cue_index = this.cues.findIndex((cue) => cue.id == event.id);
      const this_cue = this.cues[cue_index] || (() => { throw new Error("can't happen") })();

      this_cue.startTime = event.start;
      this_cue.endTime = event.end;

      const previous_cue = this.cues[cue_index - 1];
      const next_cue = this.cues[cue_index + 1];

      if (previous_cue) previous_cue.endTime = event.start;
      if (next_cue) next_cue.startTime = event.end;

      this_cue.id = uuidv4();
    } else if (event.type == "gap") {
      const cue_index = this.cues.findIndex((cue) => cue.id == event.id);
      const this_cue = this.cues[cue_index] || (() => { throw new Error("can't happen") })();

      const point = Math.max(this_cue.endTime - 1, this_cue.duration() / 2 + this_cue.startTime);
      this.cues.splice(cue_index + 1, 0, new Cue(
        uuidv4(),
        point,
        this_cue.endTime,
        []
      ));

      this_cue.endTime = point;

      // reroll the ID on the edited region so the waveform display picks it up
      this_cue.id = uuidv4();
    } else if (event.type == "reflow") {
      // Reflow based on sentence breaks.

      // Pass 1: Split on all the sentence breaks.
      let edits: EditEvent[] = [];
      for (const cue of this.cues) {
        let offset = 0;
        for (const index in cue.words) {
          if (cue.words[index]?.match(/[.!?]$/)) {
            const split_index = Number.parseInt(index) + 1 - offset;
            edits.push({ type: "split", id: cue.id, index: split_index });
            offset = Number.parseInt(index) + 1;
          }
        }
      }

      for (const edit of edits) {
        this.edit(edit, true);
      }

      // Pass 2: Join on all the non-sentence breaks.
      edits = [];

      for (const cue of this.cues) {
        if (cue.words.length && cue.words[cue.words.length - 1]?.match(/[^.!?]$/)) {
          edits.push({ type: "join", id: cue.id, edge: "end" });
        }
      }

      for (const edit of edits) {
        this.edit(edit, true);
      }

      // Pass 3: Join on all the short sentences.
      edits = [];

      for (const cue of this.cues) {
        if (cue.words.length < REFLOW_MIN_SENTENCE_LENGTH) {
          edits.push({ type: "join", id: cue.id, edge: "end" });
        }
      }

      for (const edit of edits) {
        this.edit(edit, true);
      }


      // Reroll all the cue IDs so the UI updates.
      for (const cue of this.cues) {
        cue.id = uuidv4();
      }
    }

    return true;
  }

  public previousStart(time: number): number {
    const current_cue = this.getCueAt(time);
    if (current_cue === undefined) {
      return time;
    }

    if (time != current_cue.startTime) {
      return current_cue.startTime;
    }

    const cue_index = this.cues.findIndex((cue) => cue.id == current_cue.id);
    const previousCue = this.cues[cue_index - 1];
    if (previousCue) {
      return previousCue.startTime;
    }

    return time;
  }

  public nextEnd(time: number): number {
    const current_cue = this.getCueAt(time);
    if (current_cue === undefined) {
      return time;
    }

    if (time != current_cue.endTime) {
      return current_cue.endTime;
    }

    const cue_index = this.cues.findIndex((cue) => cue.id == current_cue.id);
    const previousCue = this.cues[cue_index + 1];
    if (previousCue) {
      return previousCue.endTime;
    }

    return time;
  }

  public previousCue(id: string): Cue | undefined {
    const cue_index = this.cues.findIndex((cue) => cue.id == id);
    return this.cues[cue_index - 1];
  }

  public nextCue(id: string): Cue | undefined {
    const cue_index = this.cues.findIndex((cue) => cue.id == id);
    return this.cues[cue_index + 1];
  }

  public export(): string {
    const chunks = ["WEBVTT"];

    for (const cue of this.cues) {
      chunks.push(`${vttTimestamp(cue.startTime)} --> ${vttTimestamp(cue.endTime)}\n${cue.text()}`);
    }

    return chunks.join("\n\n");
  }
}
