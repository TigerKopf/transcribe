// This script will be loaded by the AudioWorklet.
class AudioDataProcessor extends AudioWorkletProcessor {
  // The process method is called for each block of audio data.
  process(inputs, outputs, parameters) {
    // We're interested in the first input, and the first channel of that input.
    const inputChannel = inputs[0][0];

    // If there's no audio data, we don't need to do anything.
    if (!inputChannel) {
      return true;
    }

    // Post the raw Float32Array data back to the main thread.
    // We transfer the underlying ArrayBuffer to avoid copying data.
    this.port.postMessage(inputChannel.buffer, [inputChannel.buffer]);

    // Return true to keep the processor alive.
    return true;
  }
}

// Register the processor. The first argument is the name we'll use to
// create the AudioWorkletNode.
registerProcessor('audio-data-processor', AudioDataProcessor);
