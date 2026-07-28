import * as THREE from 'three/webgpu';

type ApexPbrMaterial = THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;

const createNissanTestPattern = (): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#f4f4f0';
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let coordinate = 0; coordinate <= canvas.width; coordinate += 32) {
    const major = coordinate % 128 === 0;
    context.strokeStyle = major ? '#596168' : '#a9adb0';
    context.lineWidth = major ? 3 : 1;
    context.beginPath();
    context.moveTo(coordinate, 0);
    context.lineTo(coordinate, canvas.height);
    context.stroke();
    context.beginPath();
    context.moveTo(0, coordinate);
    context.lineTo(canvas.width, coordinate);
    context.stroke();
  }

  for (let y = 64; y < canvas.height; y += 128) {
    for (let x = 64; x < canvas.width; x += 128) {
      context.fillStyle = '#f4f4f0';
      context.beginPath();
      context.arc(x, y, 13, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#353b40';
      context.lineWidth = 5;
      context.stroke();
      context.fillStyle = '#596168';
      context.beginPath();
      context.arc(x, y, 5, 0, Math.PI * 2);
      context.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.anisotropy = 8;
  return texture;
};

const NISSAN_TEST_PATTERN = createNissanTestPattern();

const setOpaque = (
  material: ApexPbrMaterial,
  color: THREE.ColorRepresentation,
  metalness: number,
  roughness: number,
) => {
  material.color.set(color);
  material.metalness = metalness;
  material.roughness = roughness;
  material.transparent = false;
  material.opacity = 1;
  material.depthWrite = true;
  material.envMapIntensity = 1.15;
};

const setPaint = (
  material: ApexPbrMaterial,
  color: THREE.ColorRepresentation,
) => {
  setOpaque(material, color, 0.315, 0.285);
  material.envMapIntensity = 1.3;
  if (material instanceof THREE.MeshPhysicalMaterial) {
    material.clearcoat = 0.88;
    material.clearcoatRoughness = 0.08;
  }
};

const setGlass = (
  material: ApexPbrMaterial,
  color: THREE.ColorRepresentation,
  transmission: number,
  opacity: number,
) => {
  material.color.set(color);
  material.metalness = 0;
  material.roughness = 0.08;
  material.transparent = true;
  material.opacity = opacity;
  material.depthWrite = false;
  material.envMapIntensity = 1.2;
  if (material instanceof THREE.MeshPhysicalMaterial) {
    material.transmission = transmission;
    material.thickness = 0.035;
    material.ior = 1.45;
  }
};

const configureCorvetteMaterial = (
  material: ApexPbrMaterial,
  name: string,
  paintColor: string,
) => {
  if (name === 'car_paint_main_color') {
    setPaint(material, paintColor);
  } else if (name === 'car_painnt_black') {
    setOpaque(material, 0x05070a, 0.2, 0.22);
  } else if (name === 'car_paint_secondary_color') {
    setOpaque(material, 0x15191d, 0.48, 0.24);
  } else if (name.includes('rubber') || name === 'tire') {
    setOpaque(material, 0x090a0b, 0, 0.92);
  } else if (name.includes('brake_disc') || name.includes('brake_hub')) {
    setOpaque(material, 0x777d82, 0.88, 0.34);
  } else if (name.includes('metal_chrome')) {
    setOpaque(material, 0xaab2b8, 0.94, name.includes('rough') ? 0.24 : 0.14);
  } else if (name.includes('metal_black')) {
    setOpaque(material, 0x111417, 0.62, name.includes('rough') ? 0.38 : 0.24);
  } else if (
    name.includes('plastic_black')
    || name.includes('interior_black')
    || name.includes('window_border')
    || name.includes('black_diffuse')
  ) {
    setOpaque(material, 0x0b0d0f, 0, name.includes('interior') ? 0.72 : 0.58);
  } else if (name.includes('glass_tinted')) {
    setGlass(material, 0x07151c, 0.58, 0.58);
  } else if (name.includes('glass_clear')) {
    setGlass(material, 0xb8d4de, 0.82, 0.46);
  } else if (name.includes('glass') && name.includes('orange')) {
    setGlass(material, 0xc94d0a, 0.38, 0.74);
  } else if (name.includes('glass') && name.includes('red')) {
    setGlass(material, 0x7b0508, 0.34, 0.76);
  } else if (name.includes('white_light_bulb_on')) {
    setOpaque(material, 0xe4f5ff, 0, 0.12);
    material.emissive.set(0xbde7ff);
    material.emissiveIntensity = 2.2;
  } else if (name.includes('light_bulb')) {
    setOpaque(material, 0x241b17, 0, 0.28);
  }
};

const configureNissanMaterial = (
  material: ApexPbrMaterial,
  name: string,
  paintColor: string,
  testPattern = false,
) => {
  if (name === 'carpaintmetallicblack') {
    setPaint(material, paintColor);
    if (testPattern) material.map = NISSAN_TEST_PATTERN;
  } else if (name === 'carpaintglossblack' || name === 'pianoblack') {
    setOpaque(material, 0x030405, 0.28, 0.12);
  } else if (name === 'carpaintmetallicdarkgrey') {
    setOpaque(material, 0x252a2f, 0.46, 0.25);
  } else if (name === 'carpaintmatteblack') {
    setOpaque(material, paintColor, 0.12, 0.48);
    if (testPattern) material.map = NISSAN_TEST_PATTERN;
  } else if (name === 'carpaintmetallicgoldenyellow' || name.includes('gold')) {
    setOpaque(material, 0xc48613, 0.65, 0.24);
  } else if (name.includes('carbonfiber')) {
    setOpaque(material, 0x090b0d, 0.22, name.includes('matte') ? 0.52 : 0.3);
  } else if (name.includes('tirerubber')) {
    material.color.set(0xffffff);
    material.metalness = 0;
    material.roughness = 0.9;
    material.envMapIntensity = 0.35;
  } else if (name === 'disc' || name.includes('brakedisc')) {
    setOpaque(material, 0x747a7e, 0.9, 0.31);
  } else if (name.includes('chrome')) {
    setOpaque(material, 0xabb2b7, 0.95, 0.13);
  } else if (
    name.includes('mattblack')
    || name.includes('blackmatt')
    || name.includes('leather')
  ) {
    setOpaque(material, 0x090a0c, 0, name.includes('leather') ? 0.66 : 0.82);
  } else if (name.includes('glasswhitewindshield')) {
    setGlass(material, 0x081820, 0.72, 0.52);
  } else if (name === 'plasticglasswhite') {
    setGlass(material, 0xd2e8ee, 0.8, 0.5);
  } else if (name === 'plasticglassred') {
    setGlass(material, 0x720306, 0.42, 0.72);
  } else if (name === 'headlight') {
    setOpaque(material, 0xd8efff, 0, 0.1);
    material.emissive.set(0xbde7ff);
    material.emissiveIntensity = 2.2;
  } else if (name === 'taillight') {
    setOpaque(material, 0x180000, 0, 0.18);
    material.emissive.set(0x610000);
    material.emissiveIntensity = 0.18;
  }
};

export const configureApexCarMaterial = (
  material: ApexPbrMaterial,
  carId: string,
  paintColor: string,
): void => {
  const name = material.name.toLowerCase();
  if (carId === 'corvette-stingray') {
    configureCorvetteMaterial(material, name, paintColor);
  } else if (carId === 'nissan-gtr-r35-apex-test') {
    configureNissanMaterial(material, name, paintColor, true);
  } else if (carId === 'nissan-gtr-r35') {
    configureNissanMaterial(material, name, paintColor);
  }
  material.needsUpdate = true;
};
