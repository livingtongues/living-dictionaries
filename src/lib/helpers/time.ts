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

export function printDateWithWeekday(date: Date | number): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}
