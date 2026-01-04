import resolve from '@rollup/plugin-node-resolve';
import { terser } from 'rollup-plugin-terser';

const production = !process.env.ROLLUP_WATCH;

export default [
  // Background script
  {
    input: 'src/background/index.js',
    output: {
      file: 'dist/background.js',
      format: 'iife',
    },
    plugins: [
      resolve(),
      production && terser(),
    ],
  },
  // Content script
  {
    input: 'src/content/index.js',
    output: {
      file: 'dist/content.js',
      format: 'iife',
    },
    plugins: [
      resolve(),
      production && terser(),
    ],
  },
  // Popup (if needed)
  {
    input: 'src/popup/popup.js',
    output: {
      file: 'dist/popup.js',
      format: 'iife',
    },
    plugins: [
      resolve(),
      production && terser(),
    ],
  },
];
