import React from 'react';
import { Composition } from 'remotion';
import './fonts';
import { Kopfsatz, KopfsatzProps, kopfsatzDauer } from './Kopfsatz';
import beispiel from './beispiel.json';

export const Root: React.FC = () => (
  <Composition
    id="Kopfsatz"
    component={Kopfsatz as any}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={kopfsatzDauer(beispiel as KopfsatzProps)}
    defaultProps={beispiel as KopfsatzProps}
    calculateMetadata={({ props }) => ({ durationInFrames: kopfsatzDauer(props as KopfsatzProps) })}
  />
);
