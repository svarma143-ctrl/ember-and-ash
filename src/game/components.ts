import { createComponent, Types } from '@iwsdk/core';

export const FireItemKind = {
  Twig: 'twig',
  Log: 'log',
  Resin: 'resin',
} as const;

export const FireItem = createComponent('FireItem', {
  kind: {
    type: Types.Enum,
    default: FireItemKind.Twig,
    enum: FireItemKind,
  },
});

export const ShieldTool = createComponent('ShieldTool', {});
export const FanTool = createComponent('FanTool', {});
