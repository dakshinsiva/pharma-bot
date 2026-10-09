const speech = require('@google-cloud/speech');
const { Transform } = require('stream');

/**
 * Google Speech-to-Text Streaming Module
 * Handles real-time audio transcription with Tamil + English support
 */

class GoogleSTTStream {
  constructor(callId, onTranscriptCallback) {
    this.callId = callId;
    this.onTranscriptCallback = onTranscriptCallback;
    this.client = new speech.SpeechClient();
    this.recognizeStream = null;
    this.isActive = false;
    this.transcriptBuffer = [];
  }

  /**
   * Start streaming recognition
   */
  start() {
    if (this.isActive) {
      console.log(`[STT] Stream already active for call ${this.callId}`);
      return;
    }

    const request = {
      config: {
        encoding: 'MULAW', // Twilio uses MULAW, adjust if needed
        sampleRateHertz: 8000, // Standard telephony sample rate
        languageCode: 'ta-IN', // Tamil (India)
        alternativeLanguageCodes: ['en-IN'], // English fallback for medicine names
        enableAutomaticPunctuation: true,
        enableWordTimeOffsets: false,
        model: 'phone_call', // Optimized for phone calls
        useEnhanced: true,
      },
      interimResults: true, // Get real-time interim results
    };

    this.recognizeStream = this.client
      .streamingRecognize(request)
      .on('error', (error) => {
        console.error(`[STT] Error for call ${this.callId}:`, error);
        this.handleError(error);
      })
      .on('data', (data) => {
        this.handleTranscript(data);
      });

    this.isActive = true;
    console.log(`[STT] Started streaming for call ${this.callId}`);
  }

  /**
   * Write audio data to the stream
   * @param {Buffer} audioChunk - PCM audio data
   */
  write(audioChunk) {
    if (!this.isActive || !this.recognizeStream) {
      console.warn(`[STT] Stream not active for call ${this.callId}`);
      return;
    }

    try {
      this.recognizeStream.write(audioChunk);
    } catch (error) {
      console.error(`[STT] Error writing to stream for call ${this.callId}:`, error);
      this.handleError(error);
    }
  }

  /**
   * Handle transcript data from Google STT
   * @param {Object} data - Response from Google STT
   */
  handleTranscript(data) {
    if (data.results[0] && data.results[0].alternatives[0]) {
      const transcript = data.results[0].alternatives[0].transcript;
      const isFinal = data.results[0].isFinal;
      const confidence = data.results[0].alternatives[0].confidence || 0;

      console.log(`[STT] Call ${this.callId} - ${isFinal ? 'FINAL' : 'INTERIM'}: ${transcript}`);

      // Only process final transcripts
      if (isFinal) {
        this.transcriptBuffer.push({
          text: transcript,
          confidence: confidence,
          timestamp: new Date().toISOString(),
        });

        // Call the callback with the transcript
        if (this.onTranscriptCallback) {
          this.onTranscriptCallback({
            callId: this.callId,
            transcript: transcript,
            confidence: confidence,
            isFinal: true,
          });
        }
      }
    }
  }

  /**
   * Handle errors in the stream
   * @param {Error} error - The error object
   */
  handleError(error) {
    console.error(`[STT] Stream error for call ${this.callId}:`, error.message);
    
    // Notify callback of error
    if (this.onTranscriptCallback) {
      this.onTranscriptCallback({
        callId: this.callId,
        error: error.message,
        isFinal: false,
      });
    }

    // Attempt to restart stream if it's a recoverable error
    if (error.code !== 11 && this.isActive) { // Code 11 is CANCELLED
      console.log(`[STT] Attempting to restart stream for call ${this.callId}`);
      this.stop();
      setTimeout(() => this.start(), 1000);
    }
  }

  /**
   * Get all transcripts for this call
   * @returns {Array} Array of transcript objects
   */
  getTranscripts() {
    return this.transcriptBuffer;
  }

  /**
   * Get full conversation text
   * @returns {String} Concatenated transcript
   */
  getFullTranscript() {
    return this.transcriptBuffer.map(t => t.text).join(' ');
  }

  /**
   * Stop the streaming recognition
   */
  stop() {
    if (!this.isActive) {
      return;
    }

    console.log(`[STT] Stopping stream for call ${this.callId}`);
    
    if (this.recognizeStream) {
      try {
        this.recognizeStream.end();
      } catch (error) {
        console.error(`[STT] Error ending stream:`, error);
      }
      this.recognizeStream = null;
    }

    this.isActive = false;
  }

  /**
   * Check if stream is active
   * @returns {Boolean}
   */
  isStreamActive() {
    return this.isActive;
  }
}

/**
 * Factory function to create and start a new STT stream
 * @param {String} callId - Unique call identifier
 * @param {Function} onTranscriptCallback - Callback function for transcripts
 * @returns {GoogleSTTStream} Active STT stream instance
 */
function startGoogleSTTStream(callId, onTranscriptCallback) {
  const stream = new GoogleSTTStream(callId, onTranscriptCallback);
  stream.start();
  return stream;
}

/**
 * Transform stream to convert Twilio's μ-law audio to format for Google STT
 */
class AudioTransformStream extends Transform {
  constructor(options = {}) {
    super(options);
    this.buffer = Buffer.alloc(0);
  }

  _transform(chunk, encoding, callback) {
    // Twilio sends base64 encoded μ-law audio
    // Google STT expects raw μ-law audio
    try {
      if (typeof chunk === 'string') {
        // Decode base64
        const audioData = Buffer.from(chunk, 'base64');
        this.push(audioData);
      } else {
        this.push(chunk);
      }
      callback();
    } catch (error) {
      callback(error);
    }
  }
}

module.exports = {
  GoogleSTTStream,
  startGoogleSTTStream,
  AudioTransformStream,
};






