// The beat sheet as data (seconds).
export const FPS = 60;
export const DURATION = 7;
export const BEATS = {
  drop: 0.0,     // a glowing orb falls toward the field
  splash: 0.45,  // it hits the centre; a ripple spreads
  swell: 1.5,    // travelling waves build across the field
  form: 3.8,     // the waves calm and the cubes rise into the word
  formed: 5.2,
  hold: 5.6,     // the word holds; a light sweep runs across it
  end: 7.0,
};

// Camera keys: time, position, look-at target.
export const CAMERA: [number, [number, number, number], [number, number, number]][] = [
  [0.0, [0, 30, 66], [0, 4, 0]],
  [1.5, [12, 26, 54], [0, 0, 0]],
  [3.0, [50, 13, 38], [0, 1, -6]],
  [3.9, [38, 30, 50], [0, 0, 0]],
  [5.2, [0, 70, 66], [0, 2, -3]],
  [7.0, [-3, 66, 62], [0, 2, -3]],
];
