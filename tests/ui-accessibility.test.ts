import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const home = readFileSync('src/app/(site)/page.tsx', 'utf8');
const testimonials = readFileSync('src/app/(site)/testimonials/page.tsx', 'utf8');
const field = readFileSync('src/components/ui/field.tsx', 'utf8');
const controls = readFileSync('src/components/assessment/controls.tsx', 'utf8');
const steps = readFileSync('src/components/assessment/steps.tsx', 'utf8');

describe('Phase 7 targeted responsive and field-accessibility regressions', () => {
  it('uses a shrinkable single-column track for testimonial cards at narrow widths', () => {
    for (const [path, source] of [
      ['homepage', home],
      ['testimonials page', testimonials],
    ] as const) {
      assert.match(
        source,
        /<RevealGroup className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">[\s\S]{0,420}<TestimonialCard/,
        `${path} must give the mobile testimonial track a shrinkable 1fr minimum`,
      );
    }
  });

  it('references only a hint that is rendered, and keeps rendered error IDs associated', () => {
    assert.match(field, /hint && !error \? hintId : null/);
    assert.match(field, /\{hint && !error \? \([\s\S]*<p id=\{hintId\}/);
    assert.match(field, /\{error \? \([\s\S]*<p[\s\S]*id=\{errorId\}[\s\S]*role="alert"/);
    assert.match(controls, /aria-describedby=\{ids\.describedBy\}/);
    assert.match(controls, /aria-invalid=\{ids\.invalid \|\| undefined\}/);
  });

  it('keeps Full name and Email address labels and hints in the assessment form', () => {
    assert.match(
      steps,
      /label="Full name"[\s\S]{0,260}hint="As printed on your passport, including any middle names\."/,
    );
    assert.match(
      steps,
      /label="Email address"[\s\S]{0,260}hint="We reply to this address\. Use one you check regularly\."/,
    );
  });
});
