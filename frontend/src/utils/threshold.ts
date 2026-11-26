export interface ThresholdAnalysis {
  thresholds: number[];
  tp: number[];
  fp: number[];
  tn: number[];
  fn: number[];
  positive_label: string;
  negative_label: string;
}

export interface ThresholdMetrics {
  threshold: number;
  tp: number;
  fp: number;
  tn: number;
  fn: number;
  precision: number;
  recall: number;
  f1: number;
  accuracy: number;
  fpr: number;
}

const safeDiv = (num: number, den: number): number => (den > 0 ? num / den : 0);

/** Precision, recall, F1, accuracy and FPR of the positive class at one threshold index. */
export function metricsAtIndex(data: ThresholdAnalysis, index: number): ThresholdMetrics {
  const tp = data.tp[index];
  const fp = data.fp[index];
  const tn = data.tn[index];
  const fn = data.fn[index];
  const precision = safeDiv(tp, tp + fp);
  const recall = safeDiv(tp, tp + fn);
  return {
    threshold: data.thresholds[index],
    tp,
    fp,
    tn,
    fn,
    precision,
    recall,
    f1: safeDiv(2 * precision * recall, precision + recall),
    accuracy: safeDiv(tp + tn, tp + fp + tn + fn),
    fpr: safeDiv(fp, fp + tn),
  };
}

/** Index of the threshold with the highest F1 (the lowest threshold wins ties). */
export function bestF1Index(data: ThresholdAnalysis): number {
  let best = 0;
  let bestF1 = -1;
  for (let i = 0; i < data.thresholds.length; i++) {
    const { f1 } = metricsAtIndex(data, i);
    if (f1 > bestF1) {
      bestF1 = f1;
      best = i;
    }
  }
  return best;
}

/** Index of the threshold closest to a target value, e.g. the 0.5 default. */
export function nearestIndex(data: ThresholdAnalysis, target: number): number {
  let best = 0;
  for (let i = 1; i < data.thresholds.length; i++) {
    if (Math.abs(data.thresholds[i] - target) < Math.abs(data.thresholds[best] - target)) best = i;
  }
  return best;
}
