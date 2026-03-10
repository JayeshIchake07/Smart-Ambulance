const fs = require('fs');

// Simple linear regression (multiple features) using gradient descent.
// Features: [distance_km, hour_of_day, day_of_week]

const DEFAULT_OPTIONS = {
  learningRate: 0.01,
  epochs: 8000,
};

function meanStd(array) {
  const n = array.length;
  const mean = array.reduce((s, v) => s + v, 0) / n;
  const variance = array.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  return { mean, std: Math.sqrt(variance) || 1 };
}

function normalizeColumn(col) {
  const { mean, std } = meanStd(col);
  return { norm: col.map((v) => (v - mean) / std), mean, std };
}

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

const EtaModel = {
  model: null,

  train: function(rows, options) {
    const opts = Object.assign({}, DEFAULT_OPTIONS, options || {});

    // rows: [{distance_km, hour, day_of_week, duration_minutes}, ...]
    const Xcols = [rows.map((r) => r.distance_km), rows.map((r) => r.hour), rows.map((r) => r.day_of_week)];
    const y = rows.map((r) => r.duration_minutes);

    const normalized = Xcols.map((col) => normalizeColumn(col));

    const X = rows.map((_, i) => normalized.map((n) => n.norm[i]));

    // initialize weights and bias
    let weights = new Array(X[0].length).fill(0);
    let bias = 0;
    const lr = opts.learningRate;
    const m = X.length;

    for (let epoch = 0; epoch < opts.epochs; epoch++) {
      // predictions
      const preds = X.map((row) => dot(weights, row) + bias);
      // compute gradients
      const error = preds.map((p, i) => p - y[i]);

      const gradW = new Array(weights.length).fill(0);
      let gradB = 0;

      for (let j = 0; j < weights.length; j++) {
        for (let i = 0; i < m; i++) {
          gradW[j] += (error[i] * X[i][j]);
        }
        gradW[j] = (2 / m) * gradW[j];
      }

      for (let i = 0; i < m; i++) gradB += error[i];
      gradB = (2 / m) * gradB;

      // update
      for (let j = 0; j < weights.length; j++) {
        weights[j] -= lr * gradW[j];
      }
      bias -= lr * gradB;

      // basic early stopping (small gradients)
      if (epoch % 1000 === 0 && epoch > 0) {
        const gradMag = Math.sqrt(gradW.reduce((s, v) => s + v * v, 0) + gradB * gradB);
        if (gradMag < 1e-4) break;
      }
    }

    this.model = {
      weights,
      bias,
      featureStats: normalized.map((n) => ({ mean: n.mean, std: n.std })),
      trainedAt: new Date().toISOString(),
    };

    return this.model;
  },

  predict: function(distance_km, hour, day_of_week) {
    if (!this.model) return null;
    const feats = [distance_km, hour, day_of_week];
    const norm = feats.map((v, i) => (v - this.model.featureStats[i].mean) / this.model.featureStats[i].std);
    const out = dot(this.model.weights, norm) + this.model.bias;
    // Ensure positive and sensible
    return Math.max(1, out);
  },

  save: function(filepath) {
    if (!this.model) throw new Error('No model to save');
    fs.writeFileSync(filepath, JSON.stringify(this.model, null, 2), 'utf8');
  },

  load: function(filepath) {
    try {
      const raw = fs.readFileSync(filepath, 'utf8');
      this.model = JSON.parse(raw);
      return this.model;
    } catch (e) {
      return null;
    }
  }
};

module.exports = EtaModel;
