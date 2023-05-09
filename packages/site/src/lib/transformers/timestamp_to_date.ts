import type { Timestamp } from "firebase/firestore";

export function convert_timestamp_to_date_object(timestamp: number | Date | Timestamp): Date | null {
  if (timestamp instanceof Date) {
    return timestamp;
  }
  if (typeof timestamp === 'number') {
    const SECONDS_LENGTH = 10;
    const MILLISECONDS_LENGTH = 13;
    if (timestamp.toString().length === SECONDS_LENGTH) {
      const milliseconds = timestamp * 1000;
      return new Date(milliseconds);
    }
    if (timestamp.toString().length === MILLISECONDS_LENGTH) {
      return new Date(timestamp);
    }
    return null;
  }
  // eslint-disable-next-line no-prototype-builtins
  if (timestamp?.hasOwnProperty('toDate')) {
    return timestamp.toDate();
  }
  return null;
}

if (import.meta.vitest) {
  describe('convert_timestamp_to_date_object', () => {
    const ts_in_milliseconds = 1620000000000;

    test('converts milliseconds', () => {
      const expected = new Date(ts_in_milliseconds);
      expect(convert_timestamp_to_date_object(ts_in_milliseconds)).toEqual(expected);
    });

    test('converts seconds', () => {
      const ts_in_seconds = 1620000000;
      const ts_converted_to_milliseconds = ts_in_seconds * 1000;
      const expected = new Date(ts_converted_to_milliseconds);
      expect(convert_timestamp_to_date_object(ts_in_seconds)).toEqual(expected);
    });

    test('converts a Firestore Timestamp', () => {
      const mockToDate = function () {
        return new Date(this.toMillis());
      }
      const mockToMillis = function () {
        return 1e3 * this.seconds + this.nanoseconds / 1e6;
      }
      const fs_timestamp = {
        seconds: 1620000000,
        nanoseconds: 0,
        toDate: mockToDate,
        toMillis: mockToMillis,
      } as Timestamp;
      const expected = new Date(ts_in_milliseconds);
      expect(convert_timestamp_to_date_object(fs_timestamp)).toEqual(expected);
    });

    test('leaves a date object alone', () => {
      const now = new Date();
      expect(convert_timestamp_to_date_object(now)).toBe(now);
    });

    test('handles undefined', () => {
      expect(convert_timestamp_to_date_object(undefined)).toBe(null);
    });
  });
}
