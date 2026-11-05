import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  BRAND_COLOR_REQUIREMENTS,
  DEFAULT_BRAND_COLORS,
  brandColorError,
  brandColorSummary,
  contrastRatio,
  darkenHex,
  resolveBrandColors,
} from '../src/lib/brand-colors';

describe('runtime brand colour accessibility', () => {
  it('calculates the reported WCAG ratios using relative luminance', () => {
    assert.ok(Math.abs(contrastRatio('#E11D2E', '#FFFFFF') - 4.7547) < 0.001);
    assert.ok(Math.abs(contrastRatio('#E11D2E', '#FFF1F2') - 4.3282) < 0.001);
    assert.ok(Math.abs(contrastRatio('#1E3FBF', '#FFF1F2') - 7.589) < 0.01);
    assert.ok(Math.abs(contrastRatio('#111827', '#F1F5F9') - 16.193) < 0.01);
  });

  it('accepts the accessible defaults for every intended text/focus surface', () => {
    for (const key of Object.keys(DEFAULT_BRAND_COLORS) as Array<keyof typeof DEFAULT_BRAND_COLORS>) {
      assert.equal(brandColorError(key, DEFAULT_BRAND_COLORS[key]), null, key);
    }
  });

  it('rejects a primary colour that cannot support white button text', () => {
    assert.match(brandColorError('primary', '#FFFFFF') ?? '', /at least 4\.5:1/);
  });

  it('rejects active and body text that fail against the tinted public surface', () => {
    assert.match(brandColorError('active', '#E11D2E') ?? '', /#FFF1F2/);
    assert.match(brandColorError('text', '#E11D2E') ?? '', /#FFF1F2/);
  });

  it('requires focus colours to remain visible on the pale-red active-navigation surface', () => {
    assert.match(brandColorError('secondary', '#FFFFFF') ?? '', /focus indicators/);
    assert.equal(BRAND_COLOR_REQUIREMENTS.secondary.length, 4);
    assert.ok(
      BRAND_COLOR_REQUIREMENTS.secondary.some(
        ({ background, minimum, purpose }) =>
          background === '#FFF1F2' &&
          minimum === 3 &&
          purpose.includes('active mobile-navigation'),
      ),
    );
    assert.ok(Math.abs(contrastRatio('#1D4ED8', '#FFF1F2') - 6.1005) < 0.001);
    assert.ok(Math.abs(contrastRatio('#2563EB', '#FFF1F2') - 4.7049) < 0.001);
  });

  it('falls back per-token for inaccessible legacy values without changing valid settings', () => {
    assert.deepEqual(
      resolveBrandColors({
        primary: '#FFFFFF',
        secondary: '#1D4ED8',
        active: '#E11D2E',
        text: '#FFFFFF',
      }),
      {
        ...DEFAULT_BRAND_COLORS,
        secondary: '#1D4ED8',
      },
    );
  });

  it('produces a darker hover colour with no loss of white-text contrast', () => {
    const hover = darkenHex(DEFAULT_BRAND_COLORS.primary);
    assert.equal(hover, '#C61A28');
    assert.ok(contrastRatio('#FFFFFF', hover) > contrastRatio('#FFFFFF', DEFAULT_BRAND_COLORS.primary));
  });

  it('exposes the evaluated foreground/background pairings in the CMS preview', () => {
    const summary = brandColorSummary('active', DEFAULT_BRAND_COLORS.active);
    assert.match(summary, /pressed buttons/);
    assert.match(summary, /active mobile-navigation text/);
    assert.match(summary, /7\.59:1/);
  });
});
