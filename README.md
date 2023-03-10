# captionado - caption retiming power tool

## Demo


https://user-images.githubusercontent.com/38578268/224211879-e13193b6-5869-4024-a604-75c88f096da0.mov

Demo footage from [Cathode Ray Dude](https://www.youtube.com/watch?v=dIKZCQnplDA), CC-BY 4.0.

## Introduction

`captionado` is a closed-caption / subtitle editor that's designed for modifying
the flow and exact timing of an existing set of captions, as opposed to creating
one from scratch. It's meant to be used with tools like [OpenAI
Whisper](https://github.com/openai/whisper) which can generate fairly accurate
transcripts, but don't put too much thought into making those transcripts flow
like speech.

Unlike most caption editors, which treat each cue (individual block of text) as
its own item, `captionado` treats every cue as a view into the same overall
document; it starts and ends at two points in time, and it also starts and ends
at two words in the transcript. Moving the edges of a cue moves them both in
time and within the transcript.

`captionado` also features a tool to automatically re-flow the transcript into
(approximately) one cue per sentence and a full set of NLE-inspired keyboard
shortcuts for high-speed editing. A user familiar with the video being captioned
should be able to use `captionado` to fix up Whisper-generated captions in less
than the overall runtime of the video.

## Usage

Before you begin, you'll need to prepare your transcript (in VTT format, one of
Whisper's native outputs), extract the audio from your video into a separate
file, and (ideally) resize your video to 720p or smaller (smaller videos seek faster).

Load your files into `captionado` and hit "Reflow". It'll automatically adjust
the captions so that each cue contains at least one full sentence, possibly more
if short (<4 word) sentences are involved.

Once everything finishes loading, you can start editing. `captionado` supports
both keyboard and mouse controls:

### Mouse Interface

- Use your browser-provided video controls to control the video.
- Click in the transcript to move the playhead.
- Drag the blue lines on either end of a cue to re-flow cues. You don't have to drop them directly on a word break; dropping on a word is like dropping on the gap before it.
- Shift-click the blue lines on either end of a cue to merge that cue with the cue before or after it.
- Shift-click a word boundary within a cue to split it.
- Drag the edges of the green box in the waveform to adjust precise cue timing.
- Edit text in the edit box to change the contents of the current cue.

### Keyboard Interface

`captionado` is really intended to be operated with both hands on the keyboard.
Normally, your left hand will be responsible for edits, and your right hand will
be responsible for playback.

Playback:
- Use `K` to play or pause the video.
- Use `J` and `L` to move backwards or forwards one cue.
- Use `U` and `O` to move backwards or forwards one word.
- Use `I` to play from the start of the previous cue. It's useful to make sure your timing is correct after you've retimed a cue.

Editing:
- `Q`, `A`, `E`, and `D` move cue boundaries. `Q` and `A` are the start of the
  cue, `E` and `D` are the end of the cue. The upper key moves the boundary
  earlier, the lower key moves it later.
- By default, those keys retime in 100 ms increments. Hold `Shift` to switch to reflowing by word.
  - If you used the `Reflow` macro, you likely won't have to do much manual reflowing, so the default is to adjust timing.
- `X` splits the current cue at the playhead.
- `Z` and `C` join the cue with the previous or next cue.
- `Space` jumps to the edit box.
- While in the edit box, `Escape` returns to the normal playback/edit controls.

## Build Locally

Normal webpack / npm stuff:

```
$ npm install
$ npm run build
  [load dist/index.html in your favorite web browser]
```

Other NPM scripts include `test` and `lint`. GitHub Actions will run them if you
don't, so make sure your code passes both if you submit a PR.

## FAQ

- Why does the interface look horrible?  
  I'm not any sort of web designer. My wheelhouse is somewhere around "the code other people use to make API services". PRs gladly accepted.
- Why can't I click in the waveform display to move the playhead?  
  Because I spent about an hour trying to make that work and couldn't. `wavesurfer.js`, the library I use for waveform rendering, is weird about event handling and eventually I decided it just wasn't gonna happen. I'm probaly going to revisit that one someday.
- Why do I have to upload audio separately?  
  The [WebCodecs API](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API) is not yet widely supported, and _for some reason_ I don't really feel like writing a pure-JS .mp4 demuxer.
- Why does the selected cue jump around when I retime?  
  Because you retimed over the playhead. This is technically consistent behavior in that the displayed cue is always whichever one includes the playhead, but this particular behavior violates the _hell_ out of the principle of least astonishment so I am going to do something about it eventually.
