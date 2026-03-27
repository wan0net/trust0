import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import nodePolyfills from 'rollup-plugin-polyfill-node'
import { fileURLToPath } from 'node:url'

const fetchersExternalId = fileURLToPath(
	new URL(
		'src/fetcher/index.js',
		import.meta.url
	)
)

export default [
  {
    input: 'src/index.js',
    output: {
      file: './dist/doip.core.js',
      format: 'iife',
      name: 'doip',
      globals: {
        'openpgp': 'openpgp',
        [fetchersExternalId]: 'doipFetchers'
      },
    },
    watch: {
      include: './src/**'
    },
    external: ['openpgp', './fetcher/index.js'],
    plugins: [
      commonjs(),
      json(),
      nodeResolve({
        browser: true
      }),
      nodePolyfills()
    ]
  },
  {
    input: 'src/fetcher/index.js',
    output: {
      file: './dist/doip.fetchers.js',
      format: 'iife',
      name: 'doipFetchers'
    },
    external: [],
    plugins: [
      commonjs(),
      json(),
      nodeResolve({
        browser: true
      }),
      nodePolyfills()
    ]
  },
  {
    input: 'src/fetcher/index.minimal.js',
    output: {
      file: './dist/doip.fetchers.minimal.js',
      format: 'iife',
      name: 'doipFetchers'
    },
    external: [],
    plugins: [
      commonjs(),
      json(),
      nodeResolve({
        browser: true
      }),
      nodePolyfills()
    ]
  }
]