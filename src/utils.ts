export function parseTimecode(tc: string): number {
  const re = /(?:(\d+):)?(\d+):(\d+.\d+)/;
  const found = tc.match(re);

  if (found === null) {
    throw new Error("bad timecode");
  }

  const hours = Number.parseInt(found[1] ?? "0");

  /* c8 ignore next 3 */
  if (found[2] === undefined || found[3] === undefined) {
    throw new Error("missing captures in regex; can't happen");
  }

  const minutes = Number.parseInt(found[2]);
  const seconds = Number.parseFloat(found[3]);

  return hours * 3600 + minutes * 60 + seconds;
}


export function vttTimestamp(time: number): string {
  const hours = Math.floor(time / 3600).toString().padStart(2, "0");
  const minutes = (Math.floor(time / 60) % 60).toString().padStart(2, "0");
  const seconds = (Math.floor(time % 60)).toString().padStart(2, "0");

  const millis = Math.floor((time % 1) * 1000).toString().padStart(3, "0");

  return `${hours}:${minutes}:${seconds}.${millis}`;
}
