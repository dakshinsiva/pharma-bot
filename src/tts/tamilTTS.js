const textToSpeech = require('@google-cloud/text-to-speech');
const fs = require('fs');
const util = require('util');
const path = require('path');

/**
 * Tamil Text-to-Speech Module
 * Uses Google Cloud Text-to-Speech API
 */

class TamilTTS {
  constructor() {
    this.client = new textToSpeech.TextToSpeechClient();
    this.defaultVoice = {
      languageCode: 'ta-IN', // Tamil (India)
      name: 'ta-IN-Standard-A', // Female voice
      ssmlGender: 'FEMALE',
    };
    this.audioConfig = {
      audioEncoding: 'MULAW', // Compatible with telephony systems
      sampleRateHertz: 8000, // Standard phone quality
      speakingRate: 1.0, // Normal speed
      pitch: 0.0, // Normal pitch
    };
    // Web-optimized config for browser playback
    this.webAudioConfig = {
      audioEncoding: 'LINEAR16', // Better quality for web
      sampleRateHertz: 24000, // Higher quality
      speakingRate: 1.1, // Slightly faster
      pitch: 0.0,
    };
  }

  /**
   * Convert Tamil text to speech
   * @param {String} text - Tamil text to convert
   * @param {Object} options - Optional voice and audio configuration
   * @returns {Promise<Buffer>} Audio buffer
   */
  async synthesize(text, options = {}) {
    try {
      console.log(`[TTS] Synthesizing Tamil text: ${text.substring(0, 50)}...`);

      const request = {
        input: { text: text },
        voice: options.voice || this.defaultVoice,
        audioConfig: options.audioConfig || this.audioConfig,
      };

      const [response] = await this.client.synthesizeSpeech(request);
      
      console.log(`[TTS] Successfully synthesized audio (${response.audioContent.length} bytes)`);
      
      return response.audioContent;
    } catch (error) {
      console.error('[TTS] Error synthesizing speech:', error);
      throw error;
    }
  }

  /**
   * Convert Tamil text to speech and save to file
   * @param {String} text - Tamil text to convert
   * @param {String} outputPath - Path to save the audio file
   * @param {Object} options - Optional voice and audio configuration
   * @returns {Promise<String>} Path to saved audio file
   */
  async synthesizeToFile(text, outputPath, options = {}) {
    try {
      const audioBuffer = await this.synthesize(text, options);
      
      // Ensure directory exists
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write audio to file
      await util.promisify(fs.writeFile)(outputPath, audioBuffer, 'binary');
      
      console.log(`[TTS] Audio saved to: ${outputPath}`);
      
      return outputPath;
    } catch (error) {
      console.error('[TTS] Error saving audio file:', error);
      throw error;
    }
  }

  /**
   * Convert Tamil text to base64 encoded audio
   * @param {String} text - Tamil text to convert
   * @param {Object} options - Optional voice and audio configuration
   * @returns {Promise<String>} Base64 encoded audio
   */
  async synthesizeToBase64(text, options = {}) {
    try {
      const audioBuffer = await this.synthesize(text, options);
      return audioBuffer.toString('base64');
    } catch (error) {
      console.error('[TTS] Error converting to base64:', error);
      throw error;
    }
  }

  /**
   * Get available Tamil voices
   * @returns {Promise<Array>} List of available Tamil voices
   */
  async getAvailableVoices() {
    try {
      const [response] = await this.client.listVoices({});
      const tamilVoices = response.voices.filter(voice => 
        voice.languageCodes.includes('ta-IN')
      );
      
      return tamilVoices.map(voice => ({
        name: voice.name,
        gender: voice.ssmlGender,
        languageCodes: voice.languageCodes,
      }));
    } catch (error) {
      console.error('[TTS] Error listing voices:', error);
      throw error;
    }
  }

  /**
   * Convert text with custom voice settings
   * @param {String} text - Tamil text to convert
   * @param {Object} voiceConfig - Voice configuration
   * @returns {Promise<Buffer>} Audio buffer
   */
  async synthesizeWithVoice(text, voiceConfig) {
    const options = {
      voice: {
        languageCode: voiceConfig.languageCode || 'ta-IN',
        name: voiceConfig.name || 'ta-IN-Standard-A',
        ssmlGender: voiceConfig.gender || 'FEMALE',
      },
      audioConfig: {
        audioEncoding: voiceConfig.encoding || 'MULAW',
        sampleRateHertz: voiceConfig.sampleRate || 8000,
        speakingRate: voiceConfig.speakingRate || 1.0,
        pitch: voiceConfig.pitch || 0.0,
      },
    };

    return this.synthesize(text, options);
  }

  /**
   * Synthesize with SSML for advanced control
   * @param {String} ssml - SSML formatted text
   * @param {Object} options - Optional voice and audio configuration
   * @returns {Promise<Buffer>} Audio buffer
   */
  async synthesizeSSML(ssml, options = {}) {
    try {
      console.log(`[TTS] Synthesizing SSML: ${ssml.substring(0, 50)}...`);

      const request = {
        input: { ssml: ssml },
        voice: options.voice || this.defaultVoice,
        audioConfig: options.audioConfig || this.audioConfig,
      };

      const [response] = await this.client.synthesizeSpeech(request);
      
      console.log(`[TTS] Successfully synthesized SSML audio (${response.audioContent.length} bytes)`);
      
      return response.audioContent;
    } catch (error) {
      console.error('[TTS] Error synthesizing SSML:', error);
      throw error;
    }
  }

  /**
   * Get audio configuration for different telephony providers
   * @param {String} provider - 'twilio', 'exotel', or 'default'
   * @returns {Object} Audio configuration
   */
  static getAudioConfigForProvider(provider) {
    const configs = {
      twilio: {
        audioEncoding: 'MULAW',
        sampleRateHertz: 8000,
      },
      exotel: {
        audioEncoding: 'MP3',
        sampleRateHertz: 8000,
      },
      default: {
        audioEncoding: 'MP3',
        sampleRateHertz: 24000,
      },
    };

    return configs[provider] || configs.default;
  }
}

// Create singleton instance
const tamilTTS = new TamilTTS();

/**
 * Quick synthesis function for convenience
 * @param {String} text - Tamil text to convert
 * @returns {Promise<Buffer>} Audio buffer
 */
async function synthesizeTamil(text) {
  return tamilTTS.synthesize(text);
}

/**
 * Quick synthesis to base64 for API responses
 * @param {String} text - Tamil text to convert
 * @returns {Promise<String>} Base64 encoded audio
 */
async function synthesizeTamilToBase64(text) {
  return tamilTTS.synthesizeToBase64(text);
}

module.exports = {
  TamilTTS,
  tamilTTS,
  synthesizeTamil,
  synthesizeTamilToBase64,
};



