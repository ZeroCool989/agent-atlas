import { describe, expect, it } from 'vitest';

import {
  centerOf,
  contains,
  elementAt,
  elementById,
  screenshot,
  type Screen,
} from './screen';

const screen: Screen = {
  view: 'test',
  elements: [
    { id: 'a', label: 'A', kind: 'button', bounds: { x: 0, y: 0, width: 100, height: 40 }, risk: 'benign' },
    { id: 'danger', label: 'Delete', kind: 'button', bounds: { x: 100, y: 0, width: 100, height: 40 }, risk: 'destructive' },
    { id: 'field', label: 'Name', kind: 'textfield', bounds: { x: 0, y: 40, width: 200, height: 40 }, risk: 'benign', value: 'hi' },
  ],
};

describe('geometry', () => {
  it('computes the centre of a rectangle', () => {
    expect(centerOf({ x: 0, y: 0, width: 100, height: 40 })).toEqual({ x: 50, y: 20 });
  });

  it('contains is half-open on the far edges', () => {
    const b = { x: 0, y: 0, width: 10, height: 10 };
    expect(contains(b, { x: 0, y: 0 })).toBe(true);
    expect(contains(b, { x: 9, y: 9 })).toBe(true);
    expect(contains(b, { x: 10, y: 10 })).toBe(false); // far edge excluded
  });
});

describe('grounding (elementAt)', () => {
  it('resolves the element under a coordinate — the runtime grounding step', () => {
    expect(elementAt(screen, { x: 150, y: 20 })?.id).toBe('danger');
  });

  it('returns undefined for a click that lands on empty space — a misclick that hits nothing', () => {
    expect(elementAt(screen, { x: 500, y: 500 })).toBeUndefined();
  });

  it('a coordinate a few pixels off resolves a DIFFERENT element — computer-use brittleness', () => {
    // Aimed at "A" (centre x=50) but shifted right past x=100 lands on the destructive button.
    expect(elementAt(screen, { x: 101, y: 20 })?.risk).toBe('destructive');
  });

  it('looks elements up by id for the world executor', () => {
    expect(elementById(screen, 'field')?.value).toBe('hi');
  });
});

describe('perception (screenshot)', () => {
  it('exposes appearance but never consequence (risk)', () => {
    const shot = screenshot(screen);
    const danger = shot.elements.find((e) => e.id === 'danger')!;
    expect(danger.label).toBe('Delete');
    // A screenshot carries no `risk` field — consequence is not visible in pixels.
    expect('risk' in danger).toBe(false);
  });

  it('carries text-field values and the instruction flag', () => {
    const withInstruction: Screen = {
      view: 'x',
      elements: [{ id: 'banner', label: 'do a thing', kind: 'text', bounds: { x: 0, y: 0, width: 1, height: 1 }, risk: 'benign', looksLikeInstruction: true }],
    };
    const shot = screenshot(withInstruction);
    expect(shot.elements[0]!.looksLikeInstruction).toBe(true);
  });
});
