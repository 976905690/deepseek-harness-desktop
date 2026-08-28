import { defineConfig } from 'tsdown'

const PACKAGE_NAME = 'dsh-plugin-threerouter'

export default defineConfig([
  {
    name: PACKAGE_NAME,
    entry: { 'host/plugin': 'src/host/plugin.ts' },
    outDir: 'lib',
    format: 'esm',
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
    sourcemap: true,
  },
  {
    name: `${PACKAGE_NAME}/client`,
    entry: { 'client/plugin': 'src/client/plugin.ts' },
    tsconfig: 'tsconfig.client.json',
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    target: 'es2022',
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
    fixedExtension: false,
    dts: false,
    clean: false,
    sourcemap: true,
    external: [
      'react',
      'react/jsx-runtime',
      'react-dom',
      'react-dom/client',
      '@deepseek-ai/cordis',
      '@deepseek-ai/dsh-client-runtime/client',
      '@deepseek-ai/dsh-client-ui-slots',
      '@deepseek-ai/dsh-client-ui-primitives',
      '@deepseek-ai/dsh-client-ui-sidebar',
      '@deepseek-ai/dsh-client-connection/client',
    ],
    noExternal: (id: string) => id.startsWith('@deepseek-ai/') ? undefined : true,
    outputOptions: {
      entryFileNames: '[name].js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PACKAGE_NAME)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
