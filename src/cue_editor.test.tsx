import React from 'react';
import CueEditor from './cue_editor';
import { Cue, CueSet } from './cue_set';
import { render, screen } from '@testing-library/react'

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

  const cue_editor = document.getElementById("cue-editor");
  expect(cue_editor?.innerHTML).toBe("[no cue selected]<br>");
});