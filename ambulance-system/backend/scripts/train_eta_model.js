const fs = require('fs');
const path = require('path');
const EtaModel = require('../src/ml/etaModel');

// Usage: node backend/scripts/train_eta_model.js

const dataPath = path.resolve(__dirname, '..', 'data', 'eta_training.csv');
const outPath = path.resolve(__dirname, '..', 'data', 'eta_model.json');

function readCSV(filepath) {
  const raw = fs.readFileSync(filepath, 'utf8');
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const header = lines.shift().split(',').map((h) => h.trim());
  return lines.map((line) => {
    const cols = line.split(',').map((c) => c.trim());
    const obj = {};
    header.forEach((h, i) => { obj[h] = cols[i]; });
    return obj;
  });
}

function buildRows(parsed) {
  return parsed.map((r) => ({
    distance_km: Number(r.distance_km),
    duration_minutes: Number(r.duration_minutes),
    hour: Number(r.departure_hour),
    day_of_week: Number(r.day_of_week),
  })).filter((r) => Number.isFinite(r.distance_km) && Number.isFinite(r.duration_minutes));
}

function main() {
  if (!fs.existsSync(dataPath)) {
    console.error('Training CSV not found at', dataPath);
    process.exit(1);
  }

  const parsed = readCSV(dataPath);
  const rows = buildRows(parsed);

  console.log('Training rows:', rows.length);
  const model = EtaModel.train(rows, { learningRate: 0.01, epochs: 8000 });
  EtaModel.save(outPath);
  console.log('Saved model to', outPath);
  console.log('Model summary:', { trainedAt: model.trainedAt, weights: model.weights });
}

if (require.main === module) main();
