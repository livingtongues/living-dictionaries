export function formatTime(seconds: number) {
  const mm = Math.floor(seconds / 60);
  const ss = zeroPadded(seconds % 60);
  return `${mm}:${ss}`;
}

function zeroPadded(number: number) {
  return number >= 10 ? number.toString() : `0${number}`;
}

export function printDate(date: Date | number): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function printDateTime(date: Date | number): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).format(date);
}

export function printDateWithWeekday(date: Date | number): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function minutesAgo(minutes: number) {
  return Date.now() - minutes * 1000 * 60;
  // return Timestamp.fromMillis(Date.now() - minutes * 1000 * 60);
}
