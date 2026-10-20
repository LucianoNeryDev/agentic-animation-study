import {makeProject} from '@revideo/core';
import intro from './scenes/intro';

export default makeProject({
  scenes: [intro],
  settings: {
    shared: {size: {x: 640, y: 360}, background: '#202028'},
    rendering: {fps: 30},
  },
});
