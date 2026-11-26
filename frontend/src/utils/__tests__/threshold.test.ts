import { describe, it, expect } from 'vitest';
import { ThresholdAnalysis, bestF1Index, metricsAtIndex, nearestIndex } from '../threshold';

// Five thresholds (0, .25, .5, .75, 1) over 6 validation samples: 3 positive, 3 negative.
const analysis: ThresholdAnalysis = {
  thresholds: [0, 0.25, 0.5, 0.75, 1],
  tp: [3, 3, 2, 1, 0],
  fp: [3, 2, 1, 0, 0],
  tn: [0, 1, 2, 3, 3],
  fn: [0, 0, 1, 2, 3],
  positive_label: 'yes',
  negative_label: 'no',
};

describe('metricsAtIndex', () => {
  it('derives precision, recall, F1, accuracy and FPR from the counts', () => {
    const m = metricsAtIndex(analysis, 2); // threshold 0.5: tp=2 fp=1 tn=2 fn=1
    expect(m.threshold).toBe(0.5);
    expect(m.precision).toBeCloseTo(2 / 3);
    expect(m.recall).toBeCloseTo(2 / 3);
    expect(m.f1).toBeCloseTo(2 / 3);
    expect(m.accuracy).toBeCloseTo(4 / 6);
    expect(m.fpr).toBeCloseTo(1 / 3);
  });

  it('reports zero precision and F1 instead of NaN when nothing is predicted positive', () => {
    const m = metricsAtIndex(analysis, 4); // threshold 1.0: tp=0 fp=0
    expect(m.precision).toBe(0);
    expect(m.recall).toBe(0);
    expect(m.f1).toBe(0);
  });
});

describe('bestF1Index', () => {
  it('picks the threshold with the highest F1', () => {
    // F1 per index: 0.667, 0.75, 0.667, 0.5, 0 -> index 1 (threshold 0.25)
    expect(bestF1Index(analysis)).toBe(1);
  });
});

describe('nearestIndex', () => {
  it('finds the threshold closest to the target', () => {
    expect(nearestIndex(analysis, 0.5)).toBe(2);
    expect(nearestIndex(analysis, 0.6)).toBe(2);
    expect(nearestIndex(analysis, 0.7)).toBe(3);
  });
});
