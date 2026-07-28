import { createReadStream, readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, mergeConfig, type Plugin } from 'vite';
import apexDriveConfig from '../../apex-drive/vite.config';

const appRoot = fileURLToPath(new URL('.', import.meta.url));
const driveRoot = fileURLToPath(new URL('../../apex-drive/', import.meta.url));
const assetsPublicRoot = new URL('../../packages/apex-assets/public/', import.meta.url);

const publicDemoFiles = Object.freeze([
  'assets/environments/ambientcg/DayEnvironmentHDRI108_1K_HDR.exr',
  'assets/environments/ambientcg/DaySkyHDRI065A_1K_HDR.exr',
  'assets/environments/ambientcg/license.txt',
  'assets/ground/grass001/Grass001_1K-JPG_Color.jpg',
  'assets/ground/grass001/Grass001_1K-JPG_NormalDX.jpg',
  'assets/road/Road015A_1K-JPG_Color.jpg',
  'assets/road/Road015A_1K-JPG_NormalDX.jpg',
  'assets/road/Road015A_1K-JPG_Roughness.jpg',
  'assets/road/Road015A-license.txt',
  'assets/road/aerial-asphalt-01/aerial_asphalt_01_diff_1k.jpg',
  'assets/road/aerial-asphalt-01/aerial_asphalt_01_nor_dx_1k.jpg',
  'assets/road/aerial-asphalt-01/aerial_asphalt_01_rough_1k.jpg',
  'assets/road/aerial-asphalt-01/license.txt',
  'assets/road/asphalt-track/asphalt_track_diff_1k.jpg',
  'assets/road/asphalt-track/asphalt_track_nor_dx_1k.jpg',
  'assets/road/asphalt-track/asphalt_track_rough_1k.jpg',
  'assets/road/asphalt-track/license.txt',
  'assets/road/clean-asphalt/clean_asphalt_diff_1k.jpg',
  'assets/road/clean-asphalt/clean_asphalt_nor_dx_1k.jpg',
  'assets/road/clean-asphalt/clean_asphalt_rough_1k.jpg',
  'assets/road/clean-asphalt/license.txt',
  'assets/track/curve-lights/curve-chevron-amber.png',
  'assets/vehicles/car-covers/license.txt',
  'assets/vehicles/car-covers/scene.bin',
  'assets/vehicles/car-covers/scene.gltf',
  'assets/vehicles/apex-demo-car-001/scene.glb',
  'assets/vehicles/apex-demo-car-001/vehicle.json',
  'assets/vehicles/ford-mustang-shelby-gt500/license.txt',
  'assets/vehicles/ford-mustang-shelby-gt500/scene.bin',
  'assets/vehicles/ford-mustang-shelby-gt500/scene.gltf',
  'assets/vehicles/ford-mustang-shelby-gt500/vehicle.json',
  'assets/vehicles/rambo/license.txt',
  'assets/vehicles/rambo/scene.bin',
  'assets/vehicles/rambo/scene.gltf',
  'assets/vehicles/rambo/vehicle.json',
  'assets/vehicles/rambo/textures/black_baseColor.jpeg',
  'assets/vehicles/rambo/textures/r_light_baseColor.jpeg',
  'assets/vehicles/rambo/textures/shadow_baseColor.png',
  'assets/vehicles/rambo/textures/tire_side_baseColor.jpeg',
  'assets/vehicles/130/license.txt',
  'assets/vehicles/130/scene.bin',
  'assets/vehicles/130/scene.gltf',
  'assets/vehicles/130/vehicle.json',
  'assets/vehicles/130/textures/b_blue_baseColor.jpeg',
  'assets/vehicles/130/textures/b_pillar_baseColor.png',
  'assets/vehicles/130/textures/b_red_baseColor.jpeg',
  'assets/vehicles/130/textures/b_white_baseColor.jpeg',
  'assets/vehicles/130/textures/b_yellow_baseColor.jpeg',
  'assets/vehicles/130/textures/body2_baseColor.jpeg',
  'assets/vehicles/130/textures/body_baseColor.jpeg',
  'assets/vehicles/130/textures/doorknob_baseColor.png',
  'assets/vehicles/130/textures/duct_baseColor.png',
  'assets/vehicles/130/textures/duct_normal.png',
  'assets/vehicles/130/textures/lens_baseColor.png',
  'assets/vehicles/130/textures/lens_normal.png',
  'assets/vehicles/130/textures/logo_baseColor.png',
  'assets/vehicles/130/textures/logo_emissive.png',
  'assets/vehicles/130/textures/logo_normal.png',
  'assets/vehicles/130/textures/number_baseColor.png',
  'assets/vehicles/130/textures/number_normal.png',
  'assets/vehicles/130/textures/tire_baseColor.png',
] as const);

const publicDemoSources = new Map<string, string>(
  publicDemoFiles.map(fileName => [
    fileName,
    fileURLToPath(new URL(fileName, assetsPublicRoot)),
  ]),
);
publicDemoSources.set(
  'licenses/apex-physics/LICENSE',
  fileURLToPath(new URL('../../packages/apex-physics/LICENSE', import.meta.url)),
);
publicDemoSources.set(
  'licenses/apex-physics/THIRD_PARTY_NOTICES.md',
  fileURLToPath(new URL(
    '../../packages/apex-physics/THIRD_PARTY_NOTICES.md',
    import.meta.url,
  )),
);
publicDemoSources.set(
  'licenses/apex-physics/native/JOLT_LICENSE',
  fileURLToPath(new URL(
    '../../packages/apex-physics/native/JOLT_LICENSE',
    import.meta.url,
  )),
);
publicDemoSources.set(
  'licenses/apex-physics/native/LICENSE',
  fileURLToPath(new URL(
    '../../packages/apex-physics/native/LICENSE',
    import.meta.url,
  )),
);

const contentTypeFor = (fileName: string): string => {
  switch (extname(fileName).toLowerCase()) {
    case '.glb': return 'model/gltf-binary';
    case '.hdr': return 'application/octet-stream';
    case '.exr': return 'application/octet-stream';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.json': return 'application/json; charset=utf-8';
    case '.md': return 'text/markdown; charset=utf-8';
    case '.ogg': return 'audio/ogg';
    case '.png': return 'image/png';
    case '.txt': return 'text/plain; charset=utf-8';
    default: return 'application/octet-stream';
  }
};

const publicDemoAssets = (): Plugin => ({
  name: 'apex-demo-public-asset-allowlist',
  transformIndexHtml() {
    return [{
      tag: 'aside',
      attrs: {
        class: 'asset-attribution',
        'aria-label': 'Créditos y licencias Creative Commons',
      },
      children: [
        '<details>',
        '<summary title="Créditos y licencias">CC</summary>',
        '<div>',
        '<strong>Modelos 3D · CC BY 4.0</strong>',
        '<span><a href="https://sketchfab.com/3d-models/ford-mustang-shelby-gt500-0eaa7a16796540f29461ddae05ecdeb3" target="_blank" rel="noreferrer">Ford Mustang Shelby GT500</a> · Jiaxing · <a href="assets/vehicles/ford-mustang-shelby-gt500/license.txt" target="_blank">Licencia</a></span>',
        '<span><a href="https://sketchfab.com/3d-models/lp-0940a3d1f5e44217afb698518ab2749d" target="_blank" rel="noreferrer">Rambo</a> · ｍononofu · <a href="assets/vehicles/rambo/license.txt" target="_blank">Licencia</a></span>',
        '<span><a href="https://sketchfab.com/3d-models/130-d9485f5360224e9dbaafd24b2eec0f1a" target="_blank" rel="noreferrer">130</a> · ｍononofu · <a href="assets/vehicles/130/license.txt" target="_blank">Licencia</a></span>',
        '</div>',
        '</details>',
      ].join(''),
      injectTo: 'body',
    }];
  },
  configureServer(server) {
    server.middlewares.use((request, response, next) => {
      const pathname = decodeURIComponent(
        request.url?.split('?', 1)[0] ?? '',
      ).replace(/^\/+/, '');
      const source = publicDemoSources.get(pathname);
      if (!source) {
        next();
        return;
      }
      response.statusCode = 200;
      response.setHeader('Content-Type', contentTypeFor(pathname));
      createReadStream(source).pipe(response);
    });
  },
  generateBundle() {
    for (const [fileName, source] of publicDemoSources) {
      this.emitFile({
        type: 'asset',
        fileName,
        source: readFileSync(source),
      });
    }
  },
});

export default defineConfig(({ command }) => mergeConfig(apexDriveConfig, {
  root: driveRoot,
  base: command === 'build' ? '/apex/' : '/',
  publicDir: false,
  plugins: [publicDemoAssets()],
  define: {
    'import.meta.env.VITE_APEX_DRIVE_PROFILE': JSON.stringify('public-demo'),
    'import.meta.env.VITE_APEX_DRIVE_VEHICLE_MANIFESTS': JSON.stringify(
      JSON.stringify([
        'assets/vehicles/apex-demo-car-001/vehicle.json',
        'assets/vehicles/ford-mustang-shelby-gt500/vehicle.json',
        'assets/vehicles/rambo/vehicle.json',
        'assets/vehicles/130/vehicle.json',
      ]),
    ),
  },
  build: {
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),
  },
  server: {
    fs: {
      allow: [fileURLToPath(new URL('../../', import.meta.url))],
    },
  },
}));
