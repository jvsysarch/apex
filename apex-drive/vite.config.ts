import { createReadStream, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const apexRoot = fileURLToPath(new URL('../', import.meta.url));
const assetsPublicDir = fileURLToPath(
  new URL('../packages/apex-assets/public/', import.meta.url),
);
const physicsDistUrl = new URL(
  '../packages/apex-physics/native/dist/',
  import.meta.url,
);

export default defineConfig(({ command }) => ({
  publicDir: assetsPublicDir,
  plugins: [{
    name: 'serve-local-apex-physics-runtime',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = request.url?.split('?', 1)[0];
        if (pathname !== '/apex-physics.js' && pathname !== '/apex-physics.wasm') {
          next();
          return;
        }

        response.statusCode = 200;
        response.setHeader(
          'Content-Type',
          pathname.endsWith('.wasm') ? 'application/wasm' : 'text/javascript',
        );
        createReadStream(
          fileURLToPath(new URL(pathname.slice(1), physicsDistUrl)),
        ).pipe(response);
      });
    },
    generateBundle() {
      for (const fileName of ['apex-physics.js', 'apex-physics.wasm']) {
        this.emitFile({
          type: 'asset',
          fileName,
          source: readFileSync(fileURLToPath(new URL(fileName, physicsDistUrl))),
        });
      }
    },
  }],
  server: {
    host: '127.0.0.1',
    port: 5175,
    strictPort: true,
    fs: {
      allow: [apexRoot],
    },
    watch: {
      // `dist` sólo es salida de build. Vigilarlo durante el editor hace que
      // Chokidar intente abrir los .ogg copiados y falle en Windows si el
      // navegador o un reproductor los mantiene bloqueados.
      ignored: ['**/dist/**', '**/src/track/generated/**'],
    },
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
  },
}));
