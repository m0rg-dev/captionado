import { parseTimecode, vttTimestamp } from "./utils";

describe('parseTimecode', () => {
  test('minutes-seconds-millis', () => {
    expect(parseTimecode("01:02.030")).toBeCloseTo(62.03);
  });

  test('hours-minutes-seconds-millis', () => {
    expect(parseTimecode("01:02:03.040")).toBeCloseTo(3723.04);
  });

  test('bad timecode', () => {
    expect(() => parseTimecode("horsebooks")).toThrow();
  })
});

test('vttTimestamp', () => {
  expect(vttTimestamp(0)).toEqual("00:00:00.000");
  expect(vttTimestamp(62.03)).toEqual("00:01:02.030");
  expect(vttTimestamp(3723)).toEqual("01:02:03.000");

  // hour can go to 4 digits
  expect(vttTimestamp(1000 * 3600)).toEqual("1000:00:00.000");
});