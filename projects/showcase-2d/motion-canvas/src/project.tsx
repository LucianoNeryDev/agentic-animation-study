import {makeProject} from '@revideo/core';
import fight from './scenes/fight';

export default makeProject({
  scenes: [fight],
  settings: {
    shared: {size: {x: 1920, y: 1080}, background: '#181a36'},
    rendering: {fps: 60},
  },
});
