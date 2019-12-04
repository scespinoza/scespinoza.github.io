import numpy as np
import matplotlib.pyplot as plt
import pyaudio

SAMPLING_FREQ = 44100
SIGNATURE = 4/4
BPM = 110
""" 
Generator Model:
2 * pi * frequency * [samples] / sampling frequency

"""
def add_vibrato(duration, freq, bpm=110, frac=1/4):
    vibrato_freq = SIGNATURE * freq * bpm / 60
    return freq + 4 * np.sin(2 * np.pi * vibrato_freq * np.arange(duration * SAMPLING_FREQ) / SAMPLING_FREQ).astype(np.float32)


def sine_wave(duration, freq=440, vibrato=False):
    if vibrato:
        vibrato = add_vibrato(duration, freq)
        return np.sin(2 * np.pi * vibrato * np.arange(duration * SAMPLING_FREQ) / SAMPLING_FREQ).astype(np.float32)
    else:
        return np.sin(2 * np.pi * freq * np.arange(duration * SAMPLING_FREQ) / SAMPLING_FREQ).astype(np.float32)
    
def square_wave(duration, freq, vibrato=False):
    return np.sign(sine_wave(duration, freq, vibrato))

if __name__ == '__main__':
    
    p = pyaudio.PyAudio()

    stream = p.open(format=pyaudio.paFloat32,
                    channels=1,
                    rate=SAMPLING_FREQ,
                    output=True)
    stream.write(0.5 * square_wave(60, 110))
    stream.stop_stream()
    stream.close()
    p.terminate()