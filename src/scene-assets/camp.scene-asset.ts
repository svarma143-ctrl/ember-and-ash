/**
 * Ember & Ash - procedural scene assets.
 * All factories return parentless Object3D prototypes for the asset manifest.
 */

import {
  BoxGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  DoubleSide,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  SphereGeometry,
} from 'three';

const std = (color: number, roughness = 0.9, metalness = 0): MeshStandardMaterial =>
  new MeshStandardMaterial({ color, roughness, metalness });

const emissive = (
  color: number,
  e: number,
  intensity: number,
): MeshStandardMaterial =>
  new MeshStandardMaterial({
    color,
    emissive: e,
    emissiveIntensity: intensity,
    roughness: 0.4,
  });

/* ---------- environment ---------- */

export function createGround(): Object3D {
  const g = new CylinderGeometry(16, 16, 0.1, 40);
  const m = new Mesh(g, std(0x141b2e, 1));
  m.position.y = -0.05;
  m.receiveShadow = true;
  return m;
}

export function createClearingRing(): Object3D {
  // A ring of standing stones framing the fire circle
  const group = new Object3D();
  const stoneMat = std(0x2e3550, 0.95);
  const stoneGeo = new DodecahedronGeometry(0.34, 0);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.22;
    if (Math.abs(a - Math.PI * 1.5) < 0.5) {
      continue; // leave an opening toward the player
    }
    const s = new Mesh(stoneGeo, stoneMat);
    s.position.set(Math.cos(a) * 2.1, 0.3, Math.sin(a) * 2.1);
    s.scale.set(0.7 + (i % 3) * 0.25, 0.9 + ((i * 7) % 3) * 0.35, 0.7);
    s.rotation.set(i * 1.3, i * 2.1, i * 0.7);
    s.castShadow = true;
    group.add(s);
  }
  return group;
}

export function createPine(): Object3D {
  const group = new Object3D();
  const trunk = new Mesh(
    new CylinderGeometry(0.09, 0.13, 1.1, 7),
    std(0x2a2019, 1),
  );
  trunk.position.y = 0.55;
  group.add(trunk);
  const green = std(0x16283a, 0.95);
  const tiers: Array<[number, number, number]> = [
    [1.05, 1.5, 1.35],
    [0.8, 1.2, 2.15],
    [0.55, 0.95, 2.85],
  ];
  for (const [r, h, y] of tiers) {
    const cone = new Mesh(new ConeGeometry(r, h, 8), green);
    cone.position.y = y;
    group.add(cone);
  }
  return group;
}

export function createTent(): Object3D {
  const group = new Object3D();
  const body = new Mesh(
    new ConeGeometry(0.95, 1.55, 4),
    std(0x51383b, 0.95),
  );
  body.position.y = 0.78;
  body.rotation.y = Math.PI / 4;
  body.castShadow = true;
  group.add(body);
  const door = new Mesh(
    new PlaneGeometry(0.42, 0.62),
    new MeshStandardMaterial({
      color: 0x1a1316,
      roughness: 1,
      side: DoubleSide,
    }),
  );
  door.position.set(0, 0.34, 0.672);
  group.add(door);
  return group;
}

export function createMoon(): Object3D {
  const moon = new Mesh(
    new SphereGeometry(0.55, 20, 20),
    emissive(0xf4f1de, 0xfff8d6, 1.6),
  );
  return moon;
}

/* ---------- fire pit ---------- */

export function createFirePit(): Object3D {
  const group = new Object3D();
  // ash mound
  const ash = new Mesh(
    new CylinderGeometry(0.52, 0.6, 0.09, 18),
    std(0x4a4a52, 1),
  );
  ash.position.y = 0.045;
  ash.receiveShadow = true;
  group.add(ash);
  // stone ring
  const stoneMat = std(0x565d78, 0.9);
  const stoneGeo = new DodecahedronGeometry(0.13, 0);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const s = new Mesh(stoneGeo, stoneMat);
    s.position.set(Math.cos(a) * 0.58, 0.1 + (i % 2) * 0.02, Math.sin(a) * 0.58);
    s.rotation.set(i * 2.1, i * 1.1, i * 3.7);
    s.scale.y = 1.25;
    s.castShadow = true;
    group.add(s);
  }
  // crossed logs
  const logMat = std(0x3a2a1c, 0.95);
  const logGeo = new CylinderGeometry(0.075, 0.085, 0.95, 9);
  const rots: Array<[number, number, number]> = [
    [0.28, 0.4, Math.PI / 2.15],
    [-0.24, 1.9, Math.PI / 2.2],
    [0.05, 3.6, Math.PI / 2.35],
  ];
  for (const [rx, ry, rz] of rots) {
    const log = new Mesh(logGeo, logMat);
    log.rotation.set(rx, ry, rz);
    log.position.y = 0.17;
    log.castShadow = true;
    group.add(log);
  }
  return group;
}

export function createFlame(): Object3D {
  // Origin at the base of the flame so scaleY grows upward naturally.
  const group = new Object3D();
  const outer = new Mesh(
    new ConeGeometry(0.26, 0.72, 10),
    new MeshStandardMaterial({
      color: 0xff8c2a,
      emissive: 0xff6a00,
      emissiveIntensity: 2.4,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    }),
  );
  outer.position.y = 0.36;
  outer.name = 'flame-outer';
  group.add(outer);
  const inner = new Mesh(
    new ConeGeometry(0.13, 0.46, 9),
    new MeshStandardMaterial({
      color: 0xffd23e,
      emissive: 0xffc93c,
      emissiveIntensity: 3.2,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    }),
  );
  inner.position.y = 0.3;
  inner.name = 'flame-inner';
  group.add(inner);
  return group;
}

export function createEmberGlow(): Object3D {
  // Glowing coal bed - pulsing emissive disc inside the pit
  const m = new Mesh(
    new CylinderGeometry(0.3, 0.3, 0.05, 16),
    emissive(0xff5a1f, 0xff3d00, 2.2),
  );
  m.position.y = 0.12;
  m.name = 'ember-glow';
  return m;
}

/* ---------- wood store & furniture ---------- */

export function createLogBench(): Object3D {
  const bench = new Object3D();
  const seat = new Mesh(
    new CylinderGeometry(0.17, 0.17, 1.15, 10),
    std(0x35291f, 0.95),
  );
  seat.rotation.z = Math.PI / 2;
  seat.position.y = 0.46;
  seat.castShadow = true;
  seat.receiveShadow = true;
  bench.add(seat);
  const legGeo = new CylinderGeometry(0.045, 0.05, 0.46, 7);
  for (const x of [-0.42, 0.42]) {
    const leg = new Mesh(legGeo, std(0x2b211a, 1));
    leg.position.set(x, 0.23, 0);
    bench.add(leg);
  }
  return bench;
}

export function createStool(): Object3D {
  const stool = new Object3D();
  const top = new Mesh(
    new CylinderGeometry(0.21, 0.21, 0.06, 10),
    std(0x3a2d22, 0.95),
  );
  top.position.y = 0.36;
  top.castShadow = true;
  stool.add(top);
  const legGeo = new CylinderGeometry(0.035, 0.04, 0.36, 6);
  for (const [x, z] of [
    [-0.14, -0.14],
    [0.14, -0.14],
    [-0.14, 0.14],
    [0.14, 0.14],
  ]) {
    const leg = new Mesh(legGeo, std(0x2b211a, 1));
    leg.position.set(x, 0.18, z);
    stool.add(leg);
  }
  return stool;
}

/* ---------- grabbable fuel ---------- */

export function createTwig(): Object3D {
  const twig = new Mesh(
    new CylinderGeometry(0.018, 0.024, 0.34, 7),
    std(0x574433, 1),
  );
  twig.castShadow = true;
  return twig;
}

export function createLog(): Object3D {
  const group = new Object3D();
  const body = new Mesh(
    new CylinderGeometry(0.075, 0.082, 0.38, 9),
    std(0x402f22, 0.95),
  );
  body.rotation.z = Math.PI / 2;
  body.castShadow = true;
  group.add(body);
  const cap = new Mesh(
    new CircleGeometry(0.074, 12),
    std(0x8a6a4a, 0.9),
  );
  cap.position.x = 0.191;
  cap.rotation.y = Math.PI / 2;
  group.add(cap);
  return group;
}

export function createResinCone(): Object3D {
  const cone = new Mesh(
    new IcosahedronGeometry(0.075, 0),
    new MeshStandardMaterial({
      color: 0xc47a1e,
      emissive: 0xa85308,
      emissiveIntensity: 0.9,
      roughness: 0.35,
      metalness: 0.1,
    }),
  );
  cone.scale.y = 1.35;
  cone.castShadow = true;
  return cone;
}

/* ---------- tools ---------- */

export function createBarkShield(): Object3D {
  const group = new Object3D();
  const disc = new Mesh(
    new CylinderGeometry(0.34, 0.36, 0.035, 18),
    std(0x54402c, 0.9),
  );
  disc.rotation.x = Math.PI / 2;
  disc.castShadow = true;
  group.add(disc);
  const rim = new Mesh(
    new CylinderGeometry(0.355, 0.355, 0.02, 18, 1, true),
    std(0x2e241a, 0.95),
  );
  rim.rotation.x = Math.PI / 2;
  group.add(rim);
  const boss = new Mesh(
    new SphereGeometry(0.06, 10, 10),
    std(0x6b5636, 0.7, 0.4),
  );
  boss.position.z = 0.035;
  group.add(boss);
  return group;
}

export function createHandFan(): Object3D {
  const group = new Object3D();
  const leafMat = new MeshStandardMaterial({
    color: 0x7a5230,
    roughness: 0.85,
    side: DoubleSide,
  });
  const leaf = new Mesh(
    new CircleGeometry(0.24, 12, 0, Math.PI * 0.62),
    leafMat,
  );
  leaf.position.y = 0.13;
  leaf.rotation.y = Math.PI; // face the holder
  group.add(leaf);
  const stick = new Mesh(
    new CylinderGeometry(0.014, 0.017, 0.3, 7),
    std(0x3a2d22, 0.9),
  );
  stick.position.y = -0.02;
  group.add(stick);
  return group;
}

export function createKindlingBasket(): Object3D {
  const basket = new Object3D();
  const bowl = new Mesh(
    new CylinderGeometry(0.24, 0.17, 0.22, 12, 1, true),
    new MeshStandardMaterial({
      color: 0x4a3826,
      roughness: 1,
      side: DoubleSide,
    }),
  );
  bowl.position.y = 0.11;
  basket.add(bowl);
  const bottom = new Mesh(
    new CylinderGeometry(0.17, 0.17, 0.03, 12),
    std(0x3a2c1f, 1),
  );
  bottom.position.y = 0.015;
  basket.add(bottom);
  return basket;
}
