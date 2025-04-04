// import WhereSpoken from './WhereSpoken.svelte';

// const dictWithMain: Partial<DictionaryView> = {
//   coordinates: { longitude: 20, latitude: 20 },
// }

// const dictWithMultiplePoints: Partial<DictionaryView> = {
//   coordinates: { longitude: 20, latitude: 20 },
//   points: [
//     { coordinates: { longitude: 24, latitude: 24 } },
//     { coordinates: { longitude: 6, latitude: 24 } },
//   ],
// }

// const dictWithRegion: Partial<DictionaryView> = {
//   coordinates: { longitude: -120, latitude: 40 },
//   points: [
//     { coordinates: { longitude: -113, latitude: 44 } },
//     { coordinates: { longitude: 6, latitude: 24 } },
//   ],
//   regions: [
//     {
//       coordinates: [
//         { longitude: -123.91406249999999, latitude: 40.97989806962013 },
//         { longitude: -118.828125, latitude: 36.03133177633187 },
//         { longitude: -115.6640625, latitude: 38.8225909761771 },
//         { longitude: -116.01562499999999, latitude: 42.8115217450979 },
//       ],
//     },
//   ],
// }

// const dictWithout: Partial<DictionaryView> = {}

// <Story name="Without coordinates">
//   <WhereSpoken
//     dictionary={dictWithout}
//     on:updateCoordinates={({ detail }) => {
//       dictWithout = {
//         ...dictWithout,
//         coordinates: { longitude: detail.longitude, latitude: detail.latitude },
//       };
//     }}
//     on:removeCoordinates={() => (dictWithout = {})}
//     on:updatePoints={({ detail }) => {
//       dictWithout = {
//         ...dictWithout,
//         points: detail,
//       };
//     }}
//     on:updateRegions={({ detail }) => {
//       dictWithout = {
//         ...dictWithout,
//         regions: detail,
//       };
//     }} />
// </Story>

// For simplicity, only the above example will update upon changes being made.

// <Story name="With main coordinates">
//   <WhereSpoken
//     dictionary={dictWithMain}
//     on:remove={() => {
//       delete dictWithMain.coordinates;
//       dictWithMain = dictWithMain;
//     }} />
// </Story>

// <Story name="With multiple points">
//   <WhereSpoken dictionary={dictWithMultiplePoints} />
// </Story>

// <Story name="With region">
//   <WhereSpoken dictionary={dictWithRegion} />
// </Story>
