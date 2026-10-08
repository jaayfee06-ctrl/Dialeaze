import io
import os
import wave
import asyncio
import time

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from faster_whisper import WhisperModel
import uvicorn


# =========================================================
# CONFIG
# =========================================================

HOST = "0.0.0.0"
PORT = int(os.getenv("PORT", "8765"))

SAMPLE_RATE = 16000
CHANNELS = 1
SAMPLE_WIDTH = 2

CHUNK_SECONDS = 1
CHUNK_BYTES = (
    SAMPLE_RATE
    * CHANNELS
    * SAMPLE_WIDTH
    * CHUNK_SECONDS
)


# =========================================================
# WHISPER
# =========================================================

print("Loading Whisper tiny model...", flush=True)

model = WhisperModel(
    "tiny",
    device="cpu",
    compute_type="int8"
)

print("Whisper model loaded successfully.")


# =========================================================
# FASTAPI
# =========================================================

app = FastAPI()


# =========================================================
# WAV CREATOR
# =========================================================

def pcm_to_wav(pcm_bytes):
    buffer = io.BytesIO()

    with wave.open(buffer, "wb") as wav:
        wav.setnchannels(CHANNELS)
        wav.setsampwidth(SAMPLE_WIDTH)
        wav.setframerate(SAMPLE_RATE)
        wav.writeframes(pcm_bytes)

    buffer.seek(0)

    return buffer


# =========================================================
# TRANSCRIBE PCM
# =========================================================
def transcribe_pcm(pcm_bytes):

    wav_file = pcm_to_wav(pcm_bytes)

    segments, info = model.transcribe(
        wav_file,
        beam_size=1,
        language="en",
        vad_filter=True
    )

    text_parts = []

    for segment in segments:
        text = segment.text.strip()

        if text:
            text_parts.append(text)

    return " ".join(text_parts).strip()


# =========================================================
# HEALTH CHECK
# =========================================================

@app.get("/")
async def health_check():

    return {
        "status": "ok",
        "service": "Dialeaze transcription worker",
        "model": "tiny"
    }


# =========================================================
# LIVE TRANSCRIPTION WEBSOCKET
# =========================================================
@app.websocket("/ws/transcribe")
async def transcription_websocket(websocket: WebSocket):

    await websocket.accept()

    print()
    print("🎙️ Live transcription client connected.", flush=True)

    audio_buffer = bytearray()

    try:

        while True:

            data = await websocket.receive_bytes()

            audio_buffer.extend(data)

            print(
    f"🎧 Received audio: "
    f"{len(data)} bytes | "
    f"buffer: {len(audio_buffer)} bytes",
    flush=True
)

            while len(audio_buffer) >= CHUNK_BYTES:

                chunk = bytes(
                    audio_buffer[:CHUNK_BYTES]
                )

                del audio_buffer[:CHUNK_BYTES]

               print(
    "🧠 Transcribing audio chunk...",
    flush=True
)
                transcription_started_at = (
                    time.perf_counter()
                )

                text = await asyncio.to_thread(
                    transcribe_pcm,
                    chunk
                )

                transcription_elapsed = (
                    time.perf_counter()
                    - transcription_started_at
                )

                print(
    f"⏱️ Whisper processing time: "
    f"{transcription_elapsed:.2f}s",
    flush=True
)

                if text:

                    print(
    f"📝 TRANSCRIPT: {text}",
    flush=True
)

                    await websocket.send_json({
                        "type": "transcript",
                        "text": text
                    })

                else:

                    await websocket.send_json({
                        "type": "transcript",
                        "text": ""
                    })

    except WebSocketDisconnect:

        print(
            "🔌 Live transcription client disconnected."
        )

    except Exception as error:

        print(
            "❌ Transcription worker error:",
            repr(error)
        )

        try:

            await websocket.send_json({
                "type": "error",
                "message": str(error)
            })

        except Exception:

            pass
# =========================================================
# START SERVER
# =========================================================

if __name__ == "__main__":

    print()
    print("========================================")
    print("DIALEAZE LIVE TRANSCRIPTION WORKER")
    print("========================================")
    print()
    print(
        f"WebSocket: "
        f"ws://{HOST}:{PORT}/ws/transcribe"
    )
    print()
    print("Worker is ready.")
    print()

    uvicorn.run(
        app,
        host=HOST,
        port=PORT
    )