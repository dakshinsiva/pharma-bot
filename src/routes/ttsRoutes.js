const logger = require('../utils/logger');
const express = require('express');
const router = express.Router();
const { synthesizeTamil, synthesizeTamilToBase64, tamilTTS } = require('../tts/tamilTTS');

/**
 * Tamil Text-to-Speech Routes
 */

/**
 * POST /api/tts/tamil
 * Convert Tamil text to speech
 */
router.post('/tamil', async (req, res) => {
  try {
    const { text, format = 'buffer', optimizeForWeb = false } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'text is required',
      });
    }

    // Use web-optimized config if requested
    const options = optimizeForWeb ? { audioConfig: tamilTTS.webAudioConfig } : {};

    if (format === 'base64') {
      const base64Audio = await tamilTTS.synthesizeToBase64(text, options);
      
      res.json({
        success: true,
        format: 'base64',
        audio: base64Audio,
        encoding: optimizeForWeb ? 'LINEAR16' : 'MULAW',
        sampleRate: optimizeForWeb ? 24000 : 8000,
      });
    } else {
      const audioBuffer = await tamilTTS.synthesize(text, options);
      
      // Set appropriate headers
      res.set('Content-Type', optimizeForWeb ? 'audio/l16' : 'audio/basic');
      res.set('Content-Length', audioBuffer.length);
      
      res.send(audioBuffer);
    }
  } catch (error) {
    logger.error('[TTSRoutes] Error synthesizing Tamil:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/tts/tamil/file
 * Convert Tamil text to speech and save to file
 */
router.post('/tamil/file', async (req, res) => {
  try {
    const { text, filename = 'output.wav' } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'text is required',
      });
    }

    const outputPath = `/tmp/${filename}`;
    const filePath = await tamilTTS.synthesizeToFile(text, outputPath);

    res.json({
      success: true,
      filePath: filePath,
      message: 'Audio saved to file',
    });
  } catch (error) {
    logger.error('[TTSRoutes] Error saving audio file:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/tts/voices
 * Get available Tamil voices
 */
router.get('/voices', async (req, res) => {
  try {
    const voices = await tamilTTS.getAvailableVoices();

    res.json({
      success: true,
      count: voices.length,
      voices: voices,
    });
  } catch (error) {
    logger.error('[TTSRoutes] Error getting voices:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/tts/tamil/custom
 * Convert Tamil text with custom voice settings
 */
router.post('/tamil/custom', async (req, res) => {
  try {
    const { text, voiceConfig } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'text is required',
      });
    }

    const audioBuffer = await tamilTTS.synthesizeWithVoice(text, voiceConfig || {});

    // Set appropriate headers
    res.set('Content-Type', 'audio/basic');
    res.set('Content-Length', audioBuffer.length);
    
    res.send(audioBuffer);
  } catch (error) {
    logger.error('[TTSRoutes] Error synthesizing with custom voice:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/tts/tamil/ssml
 * Convert SSML to speech
 */
router.post('/tamil/ssml', async (req, res) => {
  try {
    const { ssml } = req.body;

    if (!ssml) {
      return res.status(400).json({
        success: false,
        error: 'ssml is required',
      });
    }

    const audioBuffer = await tamilTTS.synthesizeSSML(ssml);

    // Set appropriate headers
    res.set('Content-Type', 'audio/basic');
    res.set('Content-Length', audioBuffer.length);
    
    res.send(audioBuffer);
  } catch (error) {
    logger.error('[TTSRoutes] Error synthesizing SSML:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;



