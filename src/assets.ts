/**
 * Ember & Ash - asset manifest.
 * Self-contained and deterministic; imported by the app runtime and the editor.
 */

import { AssetType, defineAssets } from '@iwsdk/core';
import {
  createBarkShield,
  createClearingRing,
  createEmberGlow,
  createFirePit,
  createFlame,
  createHandFan,
  createLog,
  createLogBench,
  createGround,
  createMoon,
  createPine,
  createResinCone,
  createStool,
  createTent,
  createTwig,
} from './scene-assets/camp.scene-asset.js';

const publicAssetUrl = (filePath: string): string =>
  `${import.meta.env.BASE_URL}${filePath.replace(/^\/+/u, '')}`;

const uikitml = (fileName: string, name: string) => ({
  url: publicAssetUrl(`ui/${fileName}`),
  type: AssetType.UIKitML,
  name,
});

export default defineAssets({
  ground: createGround(),
  'clearing-ring': createClearingRing(),
  pine: createPine(),
  tent: createTent(),
  moon: createMoon(),
  firepit: createFirePit(),
  flame: createFlame(),
  'ember-glow': createEmberGlow(),
  bench: createLogBench(),
  stool: createStool(),
  twig: createTwig(),
  log: createLog(),
  resin: createResinCone(),
  shield: createBarkShield(),
  fan: createHandFan(),
  'welcome-panel': uikitml('welcome.uikitml', 'Welcome Panel'),
  'hud-panel': uikitml('hud.uikitml', 'HUD Panel'),
  'result-panel': uikitml('result.uikitml', 'Result Panel'),
});
