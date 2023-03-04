import { Cue, CueSet } from "./editor";

function checkCue(cue: Cue, start: number, end: number, ...words: string[]) {
  expect(cue.words).toEqual(words);
  expect(cue.startTime).toBeCloseTo(start);
  expect(cue.endTime).toBeCloseTo(end);
}

describe('join edit', () => {
  test('join edit at start', () => {
    const set = new CueSet();

    set.addCue(new Cue("0", 0, 1, ["foo", "bar"]));
    set.addCue(new Cue("1", 1, 2, ["baz"]));

    expect(set.edit({ type: "join", edge: "start", id: "1" })).toBe(true);

    expect(set.cues).toHaveLength(1);
    checkCue(set.cues[0], 0, 2, "foo", "bar", "baz");
  });

  test('join edit at end', () => {
    const set = new CueSet();

    set.addCue(new Cue("0", 0, 1, ["foo", "bar"]));
    set.addCue(new Cue("1", 1, 2, ["baz"]));

    expect(set.edit({ type: "join", edge: "end", id: "0" })).toBe(true);

    expect(set.cues).toHaveLength(1);
    checkCue(set.cues[0], 0, 2, "foo", "bar", "baz");
  });


  test('join edit at start of first cue should do nothing', () => {
    const set = new CueSet();

    set.addCue(new Cue("0", 0, 1, ["foo", "bar"]));

    expect(set.edit({ type: "join", edge: "start", id: "0" })).toBe(false);

    expect(set.cues).toHaveLength(1);
    checkCue(set.cues[0], 0, 1, "foo", "bar");
  });

  test('join edit at end of last cue should do nothing', () => {
    const set = new CueSet();

    set.addCue(new Cue("0", 0, 1, ["foo", "bar"]));

    expect(set.edit({ type: "join", edge: "end", id: "0" })).toBe(false);

    expect(set.cues).toHaveLength(1);
    checkCue(set.cues[0], 0, 1, "foo", "bar");
  });
});

describe('split edit', () => {
  test('split edit in the middle of a cue', () => {
    const set = new CueSet();

    //                                   v here
    set.addCue(new Cue("0", 0, 2, ["foo", "bar"]));
    expect(set.edit({ type: "split", id: "0", index: 1 })).toBe(true);

    expect(set.cues).toHaveLength(2);
    checkCue(set.cues[0], 0, 1, "foo");
    checkCue(set.cues[1], 1, 2, "bar");
  });

  test('split edit at the start of a cue should do nothing', () => {
    const set = new CueSet();

    //                            v here
    set.addCue(new Cue("0", 0, 1, ["foo", "bar"]));

    expect(set.edit({ type: "split", id: "0", index: 0 })).toBe(false);

    expect(set.cues).toHaveLength(1);
    checkCue(set.cues[0], 0, 1, "foo", "bar");
  });

  test('split edit at the end of a cue should do nothing', () => {
    const set = new CueSet();

    //                                         v here
    set.addCue(new Cue("0", 0, 1, ["foo", "bar"]));

    expect(set.edit({ type: "split", id: "0", index: 2 })).toBe(false);

    expect(set.cues).toHaveLength(1);
    checkCue(set.cues[0], 0, 1, "foo", "bar");
  });
});

describe('move edit', () => {
  describe('happy path cases', () => {
    test('move start point forward', () => {
      const set = new CueSet();

      set.addCue(new Cue("0", 0, 1, ["foo"]));
      //                       from v      v to
      set.addCue(new Cue("1", 1, 2, ["bar", "baz"]));

      expect(set.edit({ type: "move", edge: "start", from_id: "1", to_id: "1", to_index: 1 })).toBe(true);

      expect(set.cues).toHaveLength(2);
      checkCue(set.cues[0], 0, 1.5, "foo", "bar");
      checkCue(set.cues[1], 1.5, 2, "baz");
    });

    test('move start point of cue 0 forward', () => {
      const set = new CueSet();
      //                       from v      v to
      set.addCue(new Cue("0", 0, 1, ["foo", "bar"]));

      expect(set.edit({ type: "move", edge: "start", from_id: "0", to_id: "0", to_index: 1 })).toBe(true);

      expect(set.cues).toHaveLength(2);
      checkCue(set.cues[0], 0, 0.5, "foo");
      checkCue(set.cues[1], 0.5, 1, "bar");
    });

    test('move start point backward (one cue)', () => {
      const set = new CueSet();

      //                                   v to
      set.addCue(new Cue("0", 0, 1, ["foo", "bar"]));
      //                       from v
      set.addCue(new Cue("1", 1, 2, ["baz"]));

      expect(set.edit({ type: "move", edge: "start", from_id: "1", to_id: "0", to_index: 1 })).toBe(true);

      expect(set.cues).toHaveLength(2);
      checkCue(set.cues[0], 0, 0.5, "foo");
      checkCue(set.cues[1], 0.5, 2, "bar", "baz");
    });

    test('move end point backward', () => {
      const set = new CueSet();
      //                                to v     v from
      set.addCue(new Cue("0", 0, 1, ["foo", "bar"]));
      set.addCue(new Cue("1", 1, 2, ["baz"]));

      expect(set.edit({ type: "move", edge: "end", from_id: "0", to_id: "0", to_index: 1 })).toBe(true);

      expect(set.cues).toHaveLength(2);
      checkCue(set.cues[0], 0, 0.5, "foo");
      checkCue(set.cues[1], 0.5, 2, "bar", "baz");
    });

    test('move end point of last cue backward', () => {
      const set = new CueSet();

      set.addCue(new Cue("0", 0, 1, ["foo"]));
      //                                to v     v from
      set.addCue(new Cue("1", 1, 2, ["bar", "baz"]));

      expect(set.edit({ type: "move", edge: "end", from_id: "1", to_id: "1", to_index: 1 })).toBe(true);

      expect(set.cues).toHaveLength(3);
      checkCue(set.cues[0], 0, 1, "foo");
      checkCue(set.cues[1], 1, 1.5, "bar");
      checkCue(set.cues[2], 1.5, 2, "baz");
    });

    test('move end point forward (one cue)', () => {
      const set = new CueSet();

      //                                  v from
      set.addCue(new Cue("0", 0, 1, ["foo"]));
      //                                to v
      set.addCue(new Cue("1", 1, 2, ["bar", "baz"]));

      expect(set.edit({ type: "move", edge: "end", from_id: "0", to_id: "1", to_index: 1 })).toBe(true);

      expect(set.cues).toHaveLength(2);
      checkCue(set.cues[0], 0, 1.5, "foo", "bar");
      checkCue(set.cues[1], 1.5, 2, "baz");
    });
  });
});