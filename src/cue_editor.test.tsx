import React from 'react';
import CueEditor from './cue_editor';
import { Cue, CueSet, EditEvent } from './cue_set';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

test('"no cue" displayed when appropriate', () => {
  const cues = new CueSet();
  cues.addCue(new Cue("0", 0, 1, ["foo"]));

  const onEdit = jest.fn();
  const onTimeUpdate = jest.fn();

  const time = {
    current: 2,
    maximum: 5
  };

  render(<CueEditor
    time={time}
    cues={cues}
    onEdit={onEdit}
    onTimeUpdate={onTimeUpdate}
    audio={undefined}
  />);

  const cue_editor = screen.getByLabelText("cue editor");
  expect(cue_editor?.innerHTML).toBe("[no cue selected]<br>");
  expect(onEdit).not.toBeCalled();
  expect(onTimeUpdate).not.toBeCalled();
});

test('cue text contents displayed where appropriate', () => {
  const cues = new CueSet();
  cues.addCue(new Cue("0", 0, 1, ["foo"]));
  cues.addCue(new Cue("0", 1, 2, ["bar"]));

  const onEdit = jest.fn();
  const onTimeUpdate = jest.fn();

  const time = {
    current: 0.5,
    maximum: 5
  };

  const { rerender } = render(<CueEditor
    time={time}
    cues={cues}
    onEdit={onEdit}
    onTimeUpdate={onTimeUpdate}
    audio={undefined}
  />);

  let cue_editor = screen.getByLabelText("cue editor");
  expect(cue_editor).toBeDefined();

  let cue_textarea = screen.getByRole("textbox");
  expect(cue_textarea).toBeInstanceOf(HTMLTextAreaElement);
  if (cue_textarea instanceof HTMLTextAreaElement) {
    expect(cue_textarea.value).toEqual("foo");
  }

  time.current = 1.5;

  rerender(<CueEditor
    time={time}
    cues={cues}
    onEdit={onEdit}
    onTimeUpdate={onTimeUpdate}
    audio={undefined}
  />);

  cue_editor = screen.getByLabelText("cue editor");
  expect(cue_editor).toBeDefined();

  cue_textarea = screen.getByRole("textbox");
  expect(cue_textarea).toBeInstanceOf(HTMLTextAreaElement);
  if (cue_textarea instanceof HTMLTextAreaElement) {
    expect(cue_textarea.value).toEqual("bar");
  }

  expect(onEdit).not.toBeCalled();
  expect(onTimeUpdate).not.toBeCalled();
});

test('edit lock flow', async () => {
  const cues = new CueSet();
  cues.addCue(new Cue("0", 0, 1, ["foo"]));

  const onEdit = (e: EditEvent) => {
    cues.edit(e);
  }
  const onTimeUpdate = jest.fn();

  const time = {
    current: 0.5,
    maximum: 5
  };

  const { rerender } = render(<CueEditor
    time={time}
    cues={cues}
    onEdit={onEdit}
    onTimeUpdate={onTimeUpdate}
    audio={undefined}
  />);

  await userEvent.clear(screen.getByRole("textbox"));
  await userEvent.type(screen.getByRole("textbox"), "this  text will    be reformatted");

  // as long as we stay inside this cue, the text shouldn't change
  let cue_textarea = screen.getByRole("textbox");
  expect(cue_textarea).toBeInstanceOf(HTMLTextAreaElement);
  if (cue_textarea instanceof HTMLTextAreaElement) {
    expect(cue_textarea.value).toEqual("this  text will    be reformatted");
  }

  // but the contents of the cue set should.
  const cue = cues.getCueAt(0.5);
  expect(cue).toBeDefined();
  if (cue) {
    expect(cue.words).toEqual(["this", "text", "will", "be", "reformatted"]);
  }

  // even if we bump the playhead around within this cue
  time.current = 0.75;
  rerender(<CueEditor
    time={time}
    cues={cues}
    onEdit={onEdit}
    onTimeUpdate={onTimeUpdate}
    audio={undefined}
  />);

  cue_textarea = screen.getByRole("textbox");
  expect(cue_textarea).toBeInstanceOf(HTMLTextAreaElement);
  if (cue_textarea instanceof HTMLTextAreaElement) {
    expect(cue_textarea.value).toEqual("this  text will    be reformatted");
  }

  // but if we move the playhead outside...
  time.current = 1.5;
  rerender(<CueEditor
    time={time}
    cues={cues}
    onEdit={onEdit}
    onTimeUpdate={onTimeUpdate}
    audio={undefined}
  />);

  // ...and back...
  time.current = 0.5;
  rerender(<CueEditor
    time={time}
    cues={cues}
    onEdit={onEdit}
    onTimeUpdate={onTimeUpdate}
    audio={undefined}
  />);

  // ...the text should be updated.
  cue_textarea = screen.getByRole("textbox");
  expect(cue_textarea).toBeInstanceOf(HTMLTextAreaElement);
  if (cue_textarea instanceof HTMLTextAreaElement) {
    expect(cue_textarea.value).toEqual("this text will be reformatted");
  }
});
