const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeMedicineName,
  extractQuantity,
  extractStrength,
  validateMedicineItem,
  validateOrder,
} = require('../src/utils/medicineExtractor');

test('maps Tamil medicine names to their English canonical form', () => {
  assert.equal(normalizeMedicineName('பாராசிட்டமால்').name, 'Paracetamol');
  assert.equal(normalizeMedicineName('பாராசிட்டமால்').confidence, 1);
  assert.equal(normalizeMedicineName('செட்ரிசின்').name, 'Cetirizine');
  assert.equal(normalizeMedicineName('சித்ரிசின்').name, 'Cetirizine');
});

test('accepts the short spoken form and English spellings regardless of case', () => {
  assert.equal(normalizeMedicineName('பாரா').name, 'Paracetamol');
  assert.equal(normalizeMedicineName('DOLO').name, 'Dolo');
  assert.equal(normalizeMedicineName('Metformin').name, 'Metformin');
});

test('passes unknown names through with low confidence instead of dropping them', () => {
  const result = normalizeMedicineName('Zyxotrin');
  assert.equal(result.name, 'Zyxotrin');
  assert.ok(result.confidence < 0.5);
});

test('reads Tamil number words and units', () => {
  assert.deepEqual(extractQuantity('மூணு ஸ்டிரிப்').quantity, 3);
  assert.equal(extractQuantity('மூணு ஸ்டிரிப்').unit, 'strips');
  assert.equal(extractQuantity('ஒரு பாட்டில்').quantity, 1);
  assert.equal(extractQuantity('ஒரு பாட்டில்').unit, 'bottles');
  assert.equal(extractQuantity('ரெண்டு டேப்லட்').unit, 'tablets');
});

test('reads digits with a unit, defaulting to strips', () => {
  const q = extractQuantity('2 strips');
  assert.equal(q.quantity, 2);
  assert.equal(q.unit, 'strips');
  assert.equal(extractQuantity('5').unit, 'strips');
  assert.equal(extractQuantity('none').quantity, null);
});

test('extracts a strength and assumes milligrams when the unit is spoken without one', () => {
  assert.equal(extractStrength('டோலோ 650').strength, '650mg');
  assert.equal(extractStrength('500 mg').strength, '500mg');
  assert.equal(extractStrength('5 ml').strength, '5ml');
  assert.equal(extractStrength('no number').strength, null);
});

test('a complete item validates and keeps the normalised name', () => {
  const v = validateMedicineItem({ name: 'பாராசிட்டமால்', strength: '500mg', quantity: 2 });
  assert.equal(v.valid, true);
  assert.equal(v.normalized.name, 'Paracetamol');
  assert.deepEqual(v.issues, []);
});

test('missing strength lowers confidence and is reported as an issue', () => {
  const v = validateMedicineItem({ name: 'Dolo', quantity: 1 });
  assert.ok(v.confidence < 1);
  assert.ok(v.issues.includes('Missing strength'));
});

test('an order needs at least one valid item', () => {
  assert.equal(validateOrder({ items: [] }).valid, false);
  assert.equal(validateOrder(null).valid, false);
  const order = validateOrder({
    items: [
      { name: 'Paracetamol', strength: '500mg', quantity: 3 },
      { name: 'Dolo', strength: '650mg', quantity: 2 },
    ],
  });
  assert.equal(order.valid, true);
  assert.equal(order.normalized.items.length, 2);
});
