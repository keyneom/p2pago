import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';

export default {
  input: 'src/index.ts',
  output: {
    file: 'dist/umd/zkp2p-donate.js',
    format: 'umd',
    name: 'Zkp2pDonate',
    globals: {
      ethers: 'ethers',
    },
  },
  external: ['ethers'],
  plugins: [
    json(),
    resolve(),
    commonjs(),
    typescript({ tsconfig: './tsconfig.json' }),
  ],
};
