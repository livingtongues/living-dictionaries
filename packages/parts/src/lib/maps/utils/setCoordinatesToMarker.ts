interface CoordinatesType {
  lng: number;
  lat: number;
}

export function setMarker(longitude: number, latitude: number): CoordinatesType {
  if (!(longitude && latitude)) return;
  if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90)
    return;

  return {
    lng: +longitude.toFixed(4),
    lat: +latitude.toFixed(4)
  }
}
