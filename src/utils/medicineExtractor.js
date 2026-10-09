/**
 * Medicine Extraction and Validation Module
 * Provides validation, normalization, and confidence scoring for medicine extraction
 */

// Medicine name database - Tamil to English mapping
const MEDICINE_DATABASE = {
  // Paracetamol variations
  'பாராசிட்டமால்': { name: 'Paracetamol', commonStrengths: ['500mg', '650mg', '1000mg'] },
  'பாரா': { name: 'Paracetamol', commonStrengths: ['500mg', '650mg', '1000mg'] },
  'paracetamol': { name: 'Paracetamol', commonStrengths: ['500mg', '650mg', '1000mg'] },
  
  // Dolo variations
  'டோலோ': { name: 'Dolo', commonStrengths: ['650mg', '500mg'] },
  'dolo': { name: 'Dolo', commonStrengths: ['650mg', '500mg'] },
  
  // Cetirizine variations
  'செட்ரிசின்': { name: 'Cetirizine', commonStrengths: ['10mg', '5mg'] },
  'சித்ரிசின்': { name: 'Cetirizine', commonStrengths: ['10mg', '5mg'] },
  'cetirizine': { name: 'Cetirizine', commonStrengths: ['10mg', '5mg'] },
  
  // Crocin variations
  'க்ரோசின்': { name: 'Crocin', commonStrengths: ['500mg', '650mg'] },
  'crocin': { name: 'Crocin', commonStrengths: ['500mg', '650mg'] },
  
  // Amoxicillin
  'அமோக்ஸிசில்லின்': { name: 'Amoxicillin', commonStrengths: ['250mg', '500mg'] },
  'amoxicillin': { name: 'Amoxicillin', commonStrengths: ['250mg', '500mg'] },
  
  // Aspirin
  'ஆஸ்பிரின்': { name: 'Aspirin', commonStrengths: ['75mg', '100mg', '325mg'] },
  'aspirin': { name: 'Aspirin', commonStrengths: ['75mg', '100mg', '325mg'] },
  
  // Metformin
  'மெட்ஃபார்மின்': { name: 'Metformin', commonStrengths: ['500mg', '850mg', '1000mg'] },
  'metformin': { name: 'Metformin', commonStrengths: ['500mg', '850mg', '1000mg'] },
  
  // Omeprazole
  'அயோமெப்ரோசோல்': { name: 'Omeprazole', commonStrengths: ['20mg', '40mg'] },
  'omeprazole': { name: 'Omeprazole', commonStrengths: ['20mg', '40mg'] },
};

// Quantity patterns
const QUANTITY_PATTERNS = {
  tamil: {
    'ஒரு': 1, 'ரெண்டு': 2, 'மூணு': 3, 'நாலு': 4, 'ஐந்து': 5,
    'ஆறு': 6, 'ஏழு': 7, 'எட்டு': 8, 'ஒன்பது': 9, 'பத்து': 10,
    'இருபது': 20, 'முப்பது': 30, 'நாற்பது': 40, 'ஐம்பது': 50
  },
  units: {
    'ஸ்டிரிப்': 'strips', 'strip': 'strips', 'strips': 'strips',
    'டேப்லட்': 'tablets', 'tablet': 'tablets', 'tablets': 'tablets',
    'பாட்டில்': 'bottles', 'bottle': 'bottles', 'bottles': 'bottles',
    'மாத்திரை': 'tablets', 'pills': 'tablets'
  }
};

// Strength patterns
const STRENGTH_PATTERN = /(\d+)\s*(mg|g|ml|mcg)/i;

/**
 * Normalize medicine name using fuzzy matching
 * @param {String} input - Raw medicine name from transcript
 * @returns {Object} { name: string, confidence: number, variations: array }
 */
function normalizeMedicineName(input) {
  if (!input || typeof input !== 'string') {
    return { name: null, confidence: 0, variations: [] };
  }

  const normalized = input.trim().toLowerCase();
  
  // Exact match
  if (MEDICINE_DATABASE[normalized]) {
    return {
      name: MEDICINE_DATABASE[normalized].name,
      confidence: 1.0,
      variations: [normalized],
      commonStrengths: MEDICINE_DATABASE[normalized].commonStrengths
    };
  }

  // Fuzzy matching - check if input contains known medicine
  const matches = [];
  for (const [key, value] of Object.entries(MEDICINE_DATABASE)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      const similarity = calculateSimilarity(normalized, key);
      matches.push({
        name: value.name,
        confidence: similarity,
        match: key,
        commonStrengths: value.commonStrengths
      });
    }
  }

  if (matches.length > 0) {
    // Return best match
    matches.sort((a, b) => b.confidence - a.confidence);
    return {
      name: matches[0].name,
      confidence: matches[0].confidence,
      variations: matches.map(m => m.match),
      commonStrengths: matches[0].commonStrengths
    };
  }

  // No match found
  return {
    name: input, // Return original if no match
    confidence: 0.3, // Low confidence
    variations: [],
    commonStrengths: []
  };
}

/**
 * Calculate similarity between two strings (Levenshtein-based)
 * @param {String} str1 
 * @param {String} str2 
 * @returns {Number} Similarity score 0-1
 */
function calculateSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

/**
 * Calculate Levenshtein distance
 */
function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Extract and normalize quantity
 * @param {String} input - Raw quantity text
 * @returns {Object} { quantity: number, unit: string, confidence: number }
 */
function extractQuantity(input) {
  if (!input || typeof input !== 'string') {
    return { quantity: null, unit: null, confidence: 0 };
  }

  const normalized = input.trim().toLowerCase();
  
  // Check Tamil numbers
  for (const [tamil, number] of Object.entries(QUANTITY_PATTERNS.tamil)) {
    if (normalized.includes(tamil)) {
      // Extract unit
      let unit = 'strips'; // default
      for (const [tamilUnit, englishUnit] of Object.entries(QUANTITY_PATTERNS.units)) {
        if (normalized.includes(tamilUnit)) {
          unit = englishUnit;
          break;
        }
      }
      
      return {
        quantity: number,
        unit: unit,
        confidence: 0.9
      };
    }
  }
  
  // Check numeric patterns
  const numericMatch = normalized.match(/(\d+)/);
  if (numericMatch) {
    const quantity = parseInt(numericMatch[1]);
    let unit = 'strips'; // default
    
    for (const [tamilUnit, englishUnit] of Object.entries(QUANTITY_PATTERNS.units)) {
      if (normalized.includes(tamilUnit)) {
        unit = englishUnit;
        break;
      }
    }
    
    return {
      quantity: quantity,
      unit: unit,
      confidence: 0.8
    };
  }
  
  return { quantity: null, unit: null, confidence: 0 };
}

/**
 * Extract strength from text
 * @param {String} input - Raw text
 * @returns {Object} { strength: string, confidence: number }
 */
function extractStrength(input) {
  if (!input || typeof input !== 'string') {
    return { strength: null, confidence: 0 };
  }

  // Check for numeric patterns like "650", "500mg", etc.
  const match = input.match(/(\d+)\s*(mg|g|ml|mcg)?/i);
  if (match) {
    const number = match[1];
    const unit = match[2] || 'mg';
    return {
      strength: `${number}${unit}`,
      confidence: 0.9
    };
  }
  
  return { strength: null, confidence: 0 };
}

/**
 * Validate extracted medicine order item
 * @param {Object} item - Extracted item from LLM
 * @returns {Object} { valid: boolean, normalized: object, confidence: number, issues: array }
 */
function validateMedicineItem(item) {
  const issues = [];
  let confidence = 1.0;
  
  // Check required fields
  if (!item.name) {
    issues.push('Missing medicine name');
    confidence = 0;
  }
  
  if (!item.strength) {
    issues.push('Missing strength');
    confidence *= 0.7;
  }
  
  if (!item.quantity || item.quantity <= 0) {
    issues.push('Missing or invalid quantity');
    confidence *= 0.7;
  }
  
  // Normalize medicine name
  const normalizedName = normalizeMedicineName(item.name);
  if (normalizedName.confidence < 0.5) {
    issues.push(`Low confidence medicine name: ${item.name}`);
    confidence *= normalizedName.confidence;
  }
  
  // Validate strength format
  if (item.strength) {
    const strengthMatch = item.strength.match(STRENGTH_PATTERN);
    if (!strengthMatch) {
      issues.push(`Invalid strength format: ${item.strength}`);
      confidence *= 0.8;
    }
  }
  
  // Validate quantity
  if (item.quantity && (item.quantity < 1 || item.quantity > 1000)) {
    issues.push(`Unusual quantity: ${item.quantity}`);
    confidence *= 0.9;
  }
  
  // Build normalized item
  const normalized = {
    name: normalizedName.name || item.name,
    strength: item.strength || null,
    quantity: item.quantity || null,
    notes: item.notes || '',
    confidence: confidence,
    originalName: item.name,
    suggestedStrengths: normalizedName.commonStrengths || []
  };
  
  return {
    valid: Boolean(confidence > 0.5 && normalized.name && normalized.quantity),
    normalized: normalized,
    confidence: confidence,
    issues: issues
  };
}

/**
 * Validate complete order from LLM response
 * @param {Object} orderDetails - Order details from LLM
 * @returns {Object} { valid: boolean, normalized: object, confidence: number, issues: array }
 */
function validateOrder(orderDetails) {
  if (!orderDetails || !orderDetails.items || !Array.isArray(orderDetails.items)) {
    return {
      valid: false,
      normalized: null,
      confidence: 0,
      issues: ['Invalid order structure']
    };
  }
  
  if (orderDetails.items.length === 0) {
    return {
      valid: false,
      normalized: null,
      confidence: 0,
      issues: ['No items in order']
    };
  }
  
  const validatedItems = [];
  const allIssues = [];
  let minConfidence = 1.0;
  
  for (const item of orderDetails.items) {
    const validation = validateMedicineItem(item);
    validatedItems.push(validation);
    
    if (validation.confidence < minConfidence) {
      minConfidence = validation.confidence;
    }
    
    if (validation.issues.length > 0) {
      allIssues.push(...validation.issues);
    }
  }
  
  const normalizedItems = validatedItems
    .filter(v => v.valid)
    .map(v => v.normalized);
  
  return {
    valid: normalizedItems.length > 0 && minConfidence > 0.5,
    normalized: {
      items: normalizedItems,
      notes: orderDetails.notes || '',
      confidence: minConfidence
    },
    confidence: minConfidence,
    issues: allIssues,
    validatedItems: validatedItems
  };
}

/**
 * Get suggestions for medicine name if confidence is low
 * @param {String} input - Medicine name
 * @returns {Array} Array of suggested medicine names
 */
function getMedicineSuggestions(input) {
  const normalized = normalizeMedicineName(input);
  
  if (normalized.confidence > 0.7) {
    return [normalized.name];
  }
  
  // Return top 3 matches
  const suggestions = [];
  for (const [key, value] of Object.entries(MEDICINE_DATABASE)) {
    const similarity = calculateSimilarity(input.toLowerCase(), key);
    if (similarity > 0.5) {
      suggestions.push({
        name: value.name,
        confidence: similarity,
        match: key
      });
    }
  }
  
  suggestions.sort((a, b) => b.confidence - a.confidence);
  return suggestions.slice(0, 3).map(s => s.name);
}

module.exports = {
  normalizeMedicineName,
  extractQuantity,
  extractStrength,
  validateMedicineItem,
  validateOrder,
  getMedicineSuggestions,
  MEDICINE_DATABASE,
  QUANTITY_PATTERNS
};



