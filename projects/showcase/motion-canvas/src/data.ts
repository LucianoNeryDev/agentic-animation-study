// Wall-clock seconds per 1920×1080 frame, measured while rendering the four
// showcase clips on this machine (GTX 745, i7-4790S), saving included.
export const SECONDS_PER_FRAME = [
  {route: 'Blender', how: 'Cycles, 40 samples', color: '#f5792a', value: 39.9},
  {route: 'Godot', how: 'Movie Maker', color: '#478cbf', value: 142 / 429},
  {route: 'Three.js', how: 'headless Chrome', color: '#2ec4b6', value: 32.7 / 420},
  {route: 'Motion Canvas', how: 'Revideo', color: '#e6a700', value: 15.2 / 636},
];
