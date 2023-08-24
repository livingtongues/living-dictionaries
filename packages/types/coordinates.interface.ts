export interface Coordinates {
  points?: IPoint[];
  regions?: IRegion[];
}

export interface IPoint {
  coordinates: LngLatFull;
  label?: string;
  color?: string;
}

export interface IRegion {
  coordinates: LngLatFull[];
  label?: string;
  color?: string;
}

export interface LngLatFull {
  longitude: number;
  latitude: number;
}
