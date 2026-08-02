export function get_time_zone_longitude(): number {
  const date = new Date()
  const time_zone_offset = date.getTimezoneOffset() || 0
  const time_zone_max_offset = 60 * 12
  const percentage_away_from_greenwich = time_zone_offset / time_zone_max_offset
  return percentage_away_from_greenwich * -1 * 180
  // -180 to 180 is the longitude range
}

// async function fetchIPLocation(ip: string) {
//   const url = ip.replace(/,.*/, '');
//   const res = await fetch(`https://freegeoip.app/json/${url}`);
//   if (res.ok) {
//     const data = await res.json();
//     if (data.longitude && data.latitude) {
//       const lat = data.latitude;
//       const lon = data.longitude;
//       localStorage.setItem('ip_location', JSON.stringify({ lat, lon }));
//     }
//   }
// }

// function getCachedIPLocation(): { lat: number; lon: number } {
//   return JSON.parse(localStorage.getItem('ip_location'));
// }
