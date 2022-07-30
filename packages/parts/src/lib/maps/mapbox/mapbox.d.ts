declare namespace svelte.JSX {
  interface HTMLAttributes<T> {
    onready?: (event: CustomEvent<any> & { detail: any }) => any;
    // Map.svelte
    onrecentre?: (event: CustomEvent<any> & { target: EventTarget & T }) => any;
    onzoomstart?: (event: CustomEvent<any> & { target: EventTarget & T }) => any;
    onzoom?: (event: CustomEvent<any> & { target: EventTarget & T }) => any;
    onzoomend?: (event: CustomEvent<any> & { target: EventTarget & T }) => any;
    
    // GeolocateControl.svelte
    ongeolocate?: (event: CustomEvent<any> & { target: EventTarget & T }) => any;
    onoutofmaxbounds?: (event: CustomEvent<any> & { target: EventTarget & T }) => any;
    ontrackuserlocationend?: (event: CustomEvent<any> & { target: EventTarget & T }) => any;
    ontrackuserlocationstart?: (event: CustomEvent<any> & { target: EventTarget & T }) => any;
  }
}
