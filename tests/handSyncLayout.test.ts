import { describe, expect, it } from 'vitest';
import { pointerDesignUvToVideoDeviceUv } from '../src/hand-sync/layout';

describe('hand-sync layout pointer mapping', () => {
  it('maps design-normalized pointer to video device UV (contain)', () => {
    const [vu, vv] = pointerDesignUvToVideoDeviceUv([0.54, 0.595]);
    expect(vu).toBeCloseTo(0.5403, 3);
    expect(vv).toBeCloseTo(0.5898, 3);
    expect(vv).not.toBeCloseTo(0.595, 3);
  });
});
