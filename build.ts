const shared = {
  entrypoints: ['index.ts'],
  sourcemap: 'linked' as const,
  minify: true,
};

await Promise.all([
  Bun.build({
    ...shared,
    outdir: 'dist/esm',
    format: 'esm',
    target: 'browser',
    naming: '[name].js',
  }),
  
  // CommonJS build for Node
  Bun.build({
    ...shared,
    outdir: 'dist/cjs',
    format: 'cjs',
    target: 'node',
    naming: '[name].cjs',
  }),
]);