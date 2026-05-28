import * as THREE from 'https://esm.sh/three@0.183.2';
import { EffectComposer } from 'https://esm.sh/three@0.183.2/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://esm.sh/three@0.183.2/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://esm.sh/three@0.183.2/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'https://esm.sh/three@0.183.2/examples/jsm/postprocessing/OutputPass.js';

const root = document.getElementById('root') ?? document.body;
root.style.background = '#000';
root.style.overflow = 'hidden';

const W = window.innerWidth, H = window.innerHeight;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 1000);
camera.position.set(0, 12, 40);
camera.lookAt(0, 4, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(W, H);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
root.appendChild(renderer.domElement);

// Post-processing
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.6, 0.4, 0.6);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ─── SCENE CLOCK ───────────────────────────────────────────────────────────
const clock = new THREE.Clock();
let elapsed = 0;
const TOTAL = 8.5;

// ─── COLOR PALETTE ──────────────────────────────────────────────────────────
const C = {
  peach:   new THREE.Color(0xff8c5a),
  orange:  new THREE.Color(0xff6b2e),
  gold:    new THREE.Color(0xffca7a),
  cream:   new THREE.Color(0xfff0dc),
  sky:     new THREE.Color(0x1a0a2e),
  deep:    new THREE.Color(0x0d0520),
  teal:    new THREE.Color(0x38d9c0),
  white:   new THREE.Color(0xffffff),
  soft:    new THREE.Color(0xff9966),
};

scene.background = C.deep.clone();
scene.fog = new THREE.FogExp2(0x1a0a2e, 0.012);

// ─── HELPERS ────────────────────────────────────────────────────────────────
function lerp(a, b, t) { return a + (b - a) * t; }
function easeInOut(t) { return t < .5 ? 2*t*t : -1+(4-2*t)*t; }
function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function invLerp(a, b, v) { return clamp((v - a) / (b - a), 0, 1); }
function remap(v, a, b, c, d) { return lerp(c, d, easeInOut(invLerp(a, b, v))); }

// ─── GROUND ─────────────────────────────────────────────────────────────────
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200, 80, 80),
  new THREE.MeshStandardMaterial({ color: 0x120820, roughness: 0.95, metalness: 0.05 })
);
ground.name = 'ground';
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Grid lines
const gridHelper = new THREE.GridHelper(120, 60, 0x2a1040, 0x1e0835);
gridHelper.name = 'grid';
gridHelper.position.y = 0.01;
scene.add(gridHelper);

// ─── CITY BUILDINGS ─────────────────────────────────────────────────────────
const buildings = [];
const buildingMat = new THREE.MeshStandardMaterial({ color: 0x1e1035, roughness: 0.7, metalness: 0.3 });
const windowMat  = new THREE.MeshStandardMaterial({ color: 0xffcc88, emissive: 0xffaa44, emissiveIntensity: 0.8, roughness: 0.5 });

function makeBuilding(x, z, w, h, d, col=0x1e1035) {
  const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.6, metalness: 0.4 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  body.position.set(x, h / 2, z);
  body.castShadow = true;
  body.receiveShadow = true;
  body.name = `building_${buildings.length}`;
  scene.add(body);

  // windows
  const rows = Math.floor(h / 1.4);
  const cols = Math.floor(w / 1.1);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (Math.random() > 0.55) continue;
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.7), windowMat.clone());
      win.material.emissiveIntensity = 0.5 + Math.random() * 0.8;
      win.position.set(
        x - w/2 + 0.8 + c * 1.1,
        1.0 + r * 1.4,
        z + d/2 + 0.02
      );
      win.name = `win_${buildings.length}_${r}_${c}`;
      scene.add(win);
    }
  }
  buildings.push({ mesh: body, h, x, z });
  return body;
}

// Left cluster
makeBuilding(-22, -5, 6, 14, 5, 0x1a0d30);
makeBuilding(-16, -2, 5, 20, 5, 0x1d1038);
makeBuilding(-10, -6, 4, 11, 4, 0x160a28);
// Right cluster
makeBuilding(22, -5, 6, 16, 5, 0x1a0d30);
makeBuilding(16, -2, 5, 22, 5, 0x1d1038);
makeBuilding(10, -6, 4, 12, 4, 0x160a28);
// Background
makeBuilding(-30, -15, 8, 10, 6, 0x130926);
makeBuilding(30, -15, 7, 13, 6, 0x130926);
makeBuilding(0, -18, 10, 18, 7, 0x1a0d30);
makeBuilding(-5, -12, 4, 8,  4, 0x160a28);
makeBuilding(5, -12, 4, 9,   4, 0x160a28);

// ─── ROAD ───────────────────────────────────────────────────────────────────
const road = new THREE.Mesh(
  new THREE.PlaneGeometry(8, 80),
  new THREE.MeshStandardMaterial({ color: 0x0e0a1c, roughness: 0.9 })
);
road.name = 'road';
road.rotation.x = -Math.PI / 2;
road.position.y = 0.02;
scene.add(road);

// ─── LIGHTS ─────────────────────────────────────────────────────────────────
const ambient = new THREE.AmbientLight(0x1a0a2e, 0.4);
scene.add(ambient);

const moonLight = new THREE.DirectionalLight(0xb8aaff, 0.3);
moonLight.position.set(-20, 30, 10);
moonLight.castShadow = true;
moonLight.shadow.mapSize.set(1024, 1024);
scene.add(moonLight);

const warmLight = new THREE.PointLight(0xff8c5a, 2, 40);
warmLight.name = 'warmLight';
warmLight.position.set(0, 6, 5);
scene.add(warmLight);

// Street lamps
[-6, 6, -14, 14].forEach((x, i) => {
  const lampLight = new THREE.PointLight(0xffcc88, 1.5, 12);
  lampLight.position.set(x, 5, -2);
  lampLight.name = `lamp_${i}`;
  scene.add(lampLight);
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 5, 6),
    new THREE.MeshStandardMaterial({ color: 0x2a1a4a, metalness: 0.8 })
  );
  pole.position.set(x, 2.5, -2);
  pole.name = `pole_${i}`;
  scene.add(pole);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xffdd99, emissive: 0xffbb44, emissiveIntensity: 2 })
  );
  head.position.set(x, 5.2, -2);
  head.name = `lampHead_${i}`;
  scene.add(head);
});

// ─── ROBOT ──────────────────────────────────────────────────────────────────
const robotGroup = new THREE.Group();
robotGroup.name = 'robotGroup';
robotGroup.position.set(0, -3, 8);
scene.add(robotGroup);

const robotMat = new THREE.MeshStandardMaterial({ color: 0xffb085, roughness: 0.35, metalness: 0.75 });
const robotAccent = new THREE.MeshStandardMaterial({ color: 0xff7c3a, emissive: 0xff6620, emissiveIntensity: 1.2, roughness: 0.3, metalness: 0.9 });
const robotGlow = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffeedd, emissiveIntensity: 2.5 });

// Body
const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 0.9, 8, 16), robotMat);
body.name = 'robotBody';
body.position.y = 0;
robotGroup.add(body);

// Head
const head = new THREE.Mesh(new THREE.SphereGeometry(0.52, 20, 20), robotMat.clone());
head.material.color.set(0xffc09a);
head.name = 'robotHead';
head.position.y = 1.25;
robotGroup.add(head);

// Eyes
[-0.18, 0.18].forEach((x, i) => {
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), robotGlow.clone());
  eye.name = `robotEye_${i}`;
  eye.position.set(x, 1.3, 0.48);
  robotGroup.add(eye);
});

// Ear fins
[-1, 1].forEach((side, i) => {
  const fin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.07, 0.35, 8),
    robotAccent.clone()
  );
  fin.name = `robotFin_${i}`;
  fin.rotation.z = side * Math.PI / 4;
  fin.position.set(side * 0.58, 1.32, 0);
  robotGroup.add(fin);
});

// Chest panel
const chest = new THREE.Mesh(
  new THREE.BoxGeometry(0.65, 0.45, 0.1),
  robotAccent.clone()
);
chest.name = 'robotChest';
chest.material.emissiveIntensity = 0.6;
chest.position.set(0, 0.15, 0.52);
robotGroup.add(chest);

// Arms
[-1, 1].forEach((side, i) => {
  const arm = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.12, 0.55, 6, 10),
    robotMat.clone()
  );
  arm.name = `robotArm_${i}`;
  arm.position.set(side * 0.75, -0.05, 0);
  arm.rotation.z = side * 0.25;
  robotGroup.add(arm);
});

// Antenna
const antenna = new THREE.Mesh(
  new THREE.CylinderGeometry(0.025, 0.025, 0.45, 6),
  robotMat.clone()
);
antenna.name = 'robotAntenna';
antenna.position.set(0, 1.95, 0);
robotGroup.add(antenna);
const antennaTip = new THREE.Mesh(
  new THREE.SphereGeometry(0.07, 8, 8),
  robotGlow.clone()
);
antennaTip.name = 'robotAntennaTip';
antennaTip.material.emissive.set(0xff8844);
antennaTip.position.set(0, 2.22, 0);
robotGroup.add(antennaTip);

// Hover platform
const hoverBase = new THREE.Mesh(
  new THREE.CylinderGeometry(0.5, 0.35, 0.15, 16),
  new THREE.MeshStandardMaterial({ color: 0xff9966, emissive: 0xff6633, emissiveIntensity: 0.8, roughness: 0.3, metalness: 0.9 })
);
hoverBase.name = 'robotHoverBase';
hoverBase.position.y = -1.05;
robotGroup.add(hoverBase);

// Robot glow light
const robotLight = new THREE.PointLight(0xff9966, 0, 8);
robotLight.name = 'robotLight';
robotGroup.add(robotLight);

// ─── HOLOGRAPHIC PANELS ─────────────────────────────────────────────────────
const holoMat = new THREE.MeshBasicMaterial({ color: 0x38d9c0, transparent: true, opacity: 0, side: THREE.DoubleSide });

function makePanel(x, y, z, rx, ry, w = 2.2, h = 1.4) {
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h), holoMat.clone());
  panel.position.set(x, y, z);
  panel.rotation.set(rx, ry, 0);
  panel.name = `holoPanel_${Math.random().toFixed(4)}`;
  scene.add(panel);
  return panel;
}

const panels = [
  makePanel(-4, 4, 3,  0, 0.4),
  makePanel( 4, 4, 3,  0, -0.4),
  makePanel(-3, 6, -2, 0, 0.2),
  makePanel( 3, 6, -2, 0, -0.2),
  makePanel( 0, 7, 0,  0, 0),
];

// Panel lines (scanlines effect)
panels.forEach((p, i) => {
  const lineGeo = new THREE.BufferGeometry();
  const pts = [];
  const pw = 2.2, ph = 1.4;
  for (let row = 0; row < 6; row++) {
    const y = -ph/2 + (row / 5) * ph;
    pts.push(-pw/2, y, 0.01, pw/2, y, 0.01);
  }
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const lines = new THREE.LineSegments(lineGeo,
    new THREE.LineBasicMaterial({ color: 0x55ffee, transparent: true, opacity: 0 })
  );
  lines.name = `panelLines_${i}`;
  p.add(lines);
});

// ─── WARNING ICONS ──────────────────────────────────────────────────────────
const warnIcons = [];
const warnColors = [0xff4444, 0xffaa00, 0x44ddff, 0xff44aa];
const warnLabels = ['water leakage', 'electrical hazard', 'sanitation alert', 'security issue'];
const warnPositions = [[-13, 3, -4], [13, 3, -4], [-7, 3.5, -10], [7, 3.5, -10]];

warnPositions.forEach((pos, i) => {
  const grp = new THREE.Group();
  grp.name = `warnIcon_${i}`;
  grp.position.set(...pos);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.4, 0.06, 8, 30),
    new THREE.MeshStandardMaterial({ color: warnColors[i], emissive: warnColors[i], emissiveIntensity: 2, transparent: true, opacity: 0 })
  );
  ring.name = `warnRing_${i}`;
  grp.add(ring);

  const inner = new THREE.Mesh(
    new THREE.CircleGeometry(0.25, 20),
    new THREE.MeshBasicMaterial({ color: warnColors[i], transparent: true, opacity: 0 })
  );
  inner.name = `warnInner_${i}`;
  inner.position.z = 0.01;
  grp.add(inner);

  const pulse = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.9, 30),
    new THREE.MeshBasicMaterial({ color: warnColors[i], transparent: true, opacity: 0, side: THREE.DoubleSide })
  );
  pulse.name = `warnPulse_${i}`;
  grp.add(pulse);

  grp.lookAt(camera.position);
  scene.add(grp);
  warnIcons.push({ grp, ring, inner, pulse });
});

// ─── NEURAL NETWORK LINES ───────────────────────────────────────────────────
const neuralLines = [];
function makeNeuralLine(ax, ay, az, bx, by, bz) {
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(ax, ay, az), new THREE.Vector3(bx, by, bz)
  ]);
  const mat = new THREE.LineBasicMaterial({ color: 0xff9966, transparent: true, opacity: 0 });
  const line = new THREE.Line(geo, mat);
  line.name = `neural_${neuralLines.length}`;
  scene.add(line);
  neuralLines.push(line);
  return line;
}

// Connect buildings to robot
warnPositions.forEach(([x, y, z]) => {
  makeNeuralLine(x, y, z, 0, 2, 8);
});
makeNeuralLine(-22, 7, -5, -10, 5, -2);
makeNeuralLine( 22, 8, -5,  10, 5, -2);
makeNeuralLine(-10, 5, -2, 0, 6, 0);
makeNeuralLine( 10, 5, -2, 0, 6, 0);
makeNeuralLine(0, 6, 0, 0, 3, 8);

// ─── PARTICLES ──────────────────────────────────────────────────────────────
const particleCount = 350;
const partPositions = new Float32Array(particleCount * 3);
const partSpeeds = [];
for (let i = 0; i < particleCount; i++) {
  partPositions[i*3]   = (Math.random() - 0.5) * 80;
  partPositions[i*3+1] = Math.random() * 30;
  partPositions[i*3+2] = (Math.random() - 0.5) * 60 - 10;
  partSpeeds.push(0.005 + Math.random() * 0.012);
}
const partGeo = new THREE.BufferGeometry();
partGeo.setAttribute('position', new THREE.Float32BufferAttribute(partPositions, 3));
const partMat = new THREE.PointsMaterial({ color: 0xff9966, size: 0.12, transparent: true, opacity: 0.5 });
const particles = new THREE.Points(partGeo, partMat);
particles.name = 'particles';
scene.add(particles);

// ─── PULSE RINGS ────────────────────────────────────────────────────────────
const pulseRings = [];
for (let i = 0; i < 3; i++) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1, 1.15, 48),
    new THREE.MeshBasicMaterial({ color: 0xff8866, transparent: true, opacity: 0, side: THREE.DoubleSide })
  );
  ring.name = `pulseRing_${i}`;
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(0, 0.1, 8);
  scene.add(ring);
  pulseRings.push({ mesh: ring, phase: i * (Math.PI * 2 / 3) });
}

// ─── LOGO PLANE ─────────────────────────────────────────────────────────────
// Canvas-drawn logo texture
const logoCanvas = document.createElement('canvas');
logoCanvas.width = 1024;
logoCanvas.height = 320;
const lCtx = logoCanvas.getContext('2d');

function drawLogo(alpha) {
  lCtx.clearRect(0, 0, 1024, 320);

  // Glow backing
  if (alpha > 0) {
    lCtx.save();
    lCtx.globalAlpha = alpha * 0.18;
    const grd = lCtx.createRadialGradient(512, 160, 20, 512, 160, 380);
    grd.addColorStop(0, '#ff9955');
    grd.addColorStop(1, 'transparent');
    lCtx.fillStyle = grd;
    lCtx.fillRect(0, 0, 1024, 320);
    lCtx.restore();
  }

  // Title
  lCtx.save();
  lCtx.globalAlpha = alpha;
  lCtx.font = 'bold 100px Arial, sans-serif';
  lCtx.textAlign = 'center';
  lCtx.letterSpacing = '8px';
  const titleGrd = lCtx.createLinearGradient(200, 80, 824, 160);
  titleGrd.addColorStop(0, '#ffcc88');
  titleGrd.addColorStop(0.5, '#ff9966');
  titleGrd.addColorStop(1, '#ff6633');
  lCtx.fillStyle = titleGrd;
  lCtx.fillText('Urban Pulse AI', 512, 140);

  // Subtitle
  lCtx.font = '300 32px Arial, sans-serif';
  lCtx.globalAlpha = alpha * 0.85;
  lCtx.fillStyle = '#ffddb0';
  lCtx.fillText('Intelligent Community Protection System', 512, 195);

  // Separator line
  lCtx.globalAlpha = alpha * 0.6;
  lCtx.beginPath();
  lCtx.moveTo(312, 160); lCtx.lineTo(712, 160);
  lCtx.strokeStyle = '#ff9966';
  lCtx.lineWidth = 1.5;
  lCtx.stroke();
  lCtx.restore();
}
drawLogo(0);

const logoTex = new THREE.CanvasTexture(logoCanvas);
const logoMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(10, 3.2),
  new THREE.MeshBasicMaterial({ map: logoTex, transparent: true, opacity: 0, depthWrite: false })
);
logoMesh.name = 'logoMesh';
logoMesh.position.set(0, 5, 5);
scene.add(logoMesh);

// ─── HUD OVERLAY ─────────────────────────────────────────────────────────────
const hud = document.createElement('div');
hud.style.cssText = `
  position:fixed; top:0; left:0; width:100%; height:100%;
  pointer-events:none; font-family:'Inter',sans-serif; z-index:10;
`;
root.appendChild(hud);

// Load Inter font
const fontLink = document.createElement('link');
fontLink.rel = 'stylesheet';
fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&display=swap';
document.head.appendChild(fontLink);

// AI status text
const statusEl = document.createElement('div');
statusEl.style.cssText = `
  position:absolute; bottom:12%; left:50%; transform:translateX(-50%);
  color:#ff9966; font-size:clamp(12px,1.5vw,18px); font-weight:300;
  letter-spacing:0.25em; text-transform:uppercase; opacity:0;
  text-shadow:0 0 20px #ff6633; transition:opacity 0.4s;
  white-space:nowrap;
`;
hud.appendChild(statusEl);

// Corner brackets
['tl','tr','bl','br'].forEach(pos => {
  const el = document.createElement('div');
  const isT = pos.startsWith('t'), isL = pos.endsWith('l');
  el.style.cssText = `
    position:absolute;
    ${isT ? 'top:3%' : 'bottom:3%'};
    ${isL ? 'left:2%' : 'right:2%'};
    width:28px; height:28px;
    border-${isT?'top':'bottom'}:1.5px solid #ff9966;
    border-${isL?'left':'right'}:1.5px solid #ff9966;
    opacity:0; transition:opacity 1s;
  `;
  el.id = `corner_${pos}`;
  hud.appendChild(el);
});

function setCorners(o) {
  ['tl','tr','bl','br'].forEach(p => {
    const el = document.getElementById(`corner_${p}`);
    if (el) el.style.opacity = o;
  });
}

// ─── CINEMATIC BARS ─────────────────────────────────────────────────────────
const barTop = document.createElement('div');
const barBot = document.createElement('div');
[barTop, barBot].forEach((b, i) => {
  b.style.cssText = `
    position:fixed; left:0; width:100%; height:10%;
    background:#000; z-index:20;
    transition:height 1.5s cubic-bezier(0.4,0,0.2,1);
    ${i === 0 ? 'top:0' : 'bottom:0'};
  `;
  root.appendChild(b);
});
// Start with bars closed
barTop.style.height = '18%';
barBot.style.height = '18%';
setTimeout(() => {
  barTop.style.height = '10%';
  barBot.style.height = '10%';
}, 200);

// ─── CAMERA PATH DEFINITIONS ─────────────────────────────────────────────────
// [time, camX, camY, camZ, lookX, lookY, lookZ]
const camKeyframes = [
  [0.0,  0, 12, 40,   0,  4, 0  ],   // opening wide
  [1.5,  4, 10, 32,  -2,  5, 0  ],   // slight push-in, tilt
  [2.5,  0,  7, 22,   0,  4, 0  ],   // closer to city
  [3.2,  0,  4, 14,   0,  2, 6  ],   // near robot
  [4.5, -3,  5, 12,   0,  3, 5  ],   // orbit robot
  [5.5,  2,  6, 11,   0,  4, 3  ],   // wide with holograms
  [6.5,  0,  8, 20,   0,  5, 0  ],   // pull back
  [7.5,  0, 10, 30,   0,  5, -5 ],   // zoom out for logo
  [8.5,  0, 12, 38,   0,  5, -2 ],   // final
];

function getCamState(t) {
  let a = camKeyframes[0], b = camKeyframes[camKeyframes.length - 1];
  for (let i = 0; i < camKeyframes.length - 1; i++) {
    if (t >= camKeyframes[i][0] && t <= camKeyframes[i+1][0]) {
      a = camKeyframes[i];
      b = camKeyframes[i+1];
      break;
    }
  }
  const tt = easeInOut(invLerp(a[0], b[0], t));
  return {
    pos: [lerp(a[1],b[1],tt), lerp(a[2],b[2],tt), lerp(a[3],b[3],tt)],
    look: [lerp(a[4],b[4],tt), lerp(a[5],b[5],tt), lerp(a[6],b[6],tt)],
  };
}

// ─── ANIMATION STATE ────────────────────────────────────────────────────────
let lastStatus = '';
const statusMessages = [
  [3.0, 'AI Detecting'],
  [3.8, 'Priority Analysis'],
  [4.6, 'Alerting Residents'],
  [5.5, 'Community Protected'],
];

function setStatus(msg, alpha) {
  statusEl.textContent = msg;
  statusEl.style.opacity = alpha;
}

// ─── MAIN ANIMATE LOOP ───────────────────────────────────────────────────────
function animate() {
  const dt = clock.getDelta();
  elapsed = Math.min(elapsed + dt, TOTAL);
  const t = elapsed;

  // ── SCENE 1: Smart Community (0–2s) ─────────────────────────────
  const s1 = invLerp(0, 2, t);
  scene.fog.density = lerp(0.04, 0.012, easeOut(s1));
  ambient.intensity = lerp(0.1, 0.4, easeOut(s1));
  warmLight.intensity = lerp(0, 2, easeOut(s1));

  // Particle drift
  const pos = partGeo.attributes.position.array;
  for (let i = 0; i < particleCount; i++) {
    pos[i*3+1] += partSpeeds[i] * 0.5;
    if (pos[i*3+1] > 30) pos[i*3+1] = 0;
  }
  partGeo.attributes.position.needsUpdate = true;
  partMat.opacity = lerp(0, 0.5, easeOut(s1));

  // ── SCENE 2: Robot Activation (2–3.5s) ──────────────────────────
  const s2 = invLerp(2.0, 3.5, t);
  const robotY = lerp(-3, 0, easeOut(s2));
  robotGroup.position.y = robotY;
  robotLight.intensity = lerp(0, 3, easeOut(s2));

  // Eyes pulse
  const eyePulse = 1.5 + Math.sin(t * 4) * 0.5;
  robotGroup.children.forEach(c => {
    if (c.name.startsWith('robotEye_')) c.material.emissiveIntensity = s2 * eyePulse * 2.5;
  });
  antennaTip.material.emissiveIntensity = lerp(0, 3, easeOut(s2)) + Math.sin(t * 6) * 0.5;

  // Hover bob
  if (t > 2.5) {
    robotGroup.position.y = robotY + Math.sin(t * 1.8) * 0.08;
    robotGroup.rotation.y = Math.sin(t * 0.6) * 0.2;
  }

  // Panel reveal
  panels.forEach((p, i) => {
    const delay = i * 0.18;
    const pa = invLerp(2.5 + delay, 3.2 + delay, t);
    p.material.opacity = lerp(0, 0.25, easeOut(pa));
    p.children.forEach(c => { if (c.material) c.material.opacity = lerp(0, 0.4, easeOut(pa)); });
    p.position.y += Math.sin(t * 0.9 + i) * 0.002;
  });

  // ── SCENE 3: Issue Detection (3–4.5s) ───────────────────────────
  warnIcons.forEach(({ grp, ring, inner, pulse }, i) => {
    const delay = i * 0.25;
    const wa = invLerp(3.0 + delay, 3.8 + delay, t);
    ring.material.opacity = lerp(0, 0.9, easeOut(wa));
    inner.material.opacity = lerp(0, 0.5, easeOut(wa));
    grp.position.y = warnPositions[i][1] + Math.sin(t * 2 + i) * 0.12;

    // Pulse ring expand
    const pPhase = (t * 1.2 + i * 0.5) % 1;
    pulse.scale.setScalar(1 + pPhase * 2.5);
    pulse.material.opacity = lerp(0.5, 0, pPhase) * easeOut(wa);

    // Rotate ring
    ring.rotation.z += 0.008;
  });

  // Neural lines
  neuralLines.forEach((l, i) => {
    const la = invLerp(3.5 + i * 0.1, 4.5 + i * 0.1, t);
    l.material.opacity = lerp(0, 0.6, easeOut(la));
    l.material.color.setHSL(0.08 + Math.sin(t + i) * 0.05, 1, 0.7);
  });

  // ── SCENE 4: AI Processing (4–6s) ───────────────────────────────
  const s4 = invLerp(4, 6, t);
  panels.forEach((p, i) => {
    if (s4 > 0) {
      p.material.opacity = lerp(0.25, 0.45, easeInOut(s4));
      p.material.color.setHSL(0.08 + Math.sin(t * 0.5 + i) * 0.05, 0.9, 0.65);
    }
  });

  // ── STATUS TEXT ──────────────────────────────────────────────────
  statusMessages.forEach(([st, msg]) => {
    if (t >= st && t < st + 1.2) {
      const sa = invLerp(st, st + 0.3, t) - invLerp(st + 0.8, st + 1.2, t);
      setStatus(msg, clamp(sa, 0, 1));
    }
  });
  if (t > 6.2) setStatus('', 0);

  // ── SCENE 5: Pulse & Alert (5–7s) ───────────────────────────────
  pulseRings.forEach(({ mesh, phase }, i) => {
    const pa = invLerp(5, 7, t);
    const cycle = (t * 0.8 + phase) % (Math.PI * 2);
    const scale = 1 + ((cycle / (Math.PI * 2)) * 28);
    mesh.scale.setScalar(scale);
    mesh.material.opacity = lerp(0, 0.35, easeOut(pa)) * (1 - cycle / (Math.PI * 2));
  });

  // Corner brackets
  if (t > 1) setCorners(Math.min(1, (t - 1) * 2));
  if (t > 6.5) setCorners(Math.max(0, 1 - (t - 6.5) * 3));

  // ── SCENE 6: Logo Reveal (6.5–8.5s) ────────────────────────────
  const la = invLerp(6.8, 8.2, t);
  const logoAlpha = easeOut(la);
  logoMesh.material.opacity = logoAlpha;
  drawLogo(logoAlpha);
  logoTex.needsUpdate = true;
  logoMesh.position.z = lerp(0, 8, easeOut(la));

  // Fade scene to dark behind logo
  const fadeFog = invLerp(7, 8.5, t);
  if (fadeFog > 0) scene.fog.density = lerp(0.012, 0.04, easeInOut(fadeFog));

  // Bloom intensify on logo
  bloom.strength = lerp(0.6, 1.1, logoAlpha);

  // ── CAMERA ──────────────────────────────────────────────────────
  const cam = getCamState(t);
  camera.position.set(...cam.pos);
  camera.lookAt(...cam.look);

  // Subtle camera shake during detection
  if (t > 3 && t < 5) {
    const sh = (5 - t) * 0.008;
    camera.position.x += (Math.random() - 0.5) * sh;
    camera.position.y += (Math.random() - 0.5) * sh;
  }

  // Depth of field via bloom radius
  bloom.radius = lerp(0.5, 0.8, Math.abs(Math.sin(t * 0.3)));

  composer.render();
}

renderer.setAnimationLoop(animate);

// ─── RESIZE ─────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
});
