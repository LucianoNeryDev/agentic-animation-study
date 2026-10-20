import {makeProject} from '@revideo/core';
import loop from './scenes/loop';

export default makeProject({
  scenes: [loop],
  settings: {
    shared: {size: {x: 1920, y: 1080}, background: '#0f1117'},
    rendering: {fps: 60},
  },
});
