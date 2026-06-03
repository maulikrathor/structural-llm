"""
main.py
-------
FastAPI backend. Single endpoint: POST /api/analyze
Accepts an image, returns JSON analysis + downloadable Excel and DXF.
"""

import base64
import os
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

from gemini_client import analyze_structural_drawing
from exporters import to_excel, to_dxf

load_dotenv()

app = FastAPI(title="Structural Section Analyzer")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten this in production
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

ALLOWED_MIME_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/webp"}
MAX_FILE_SIZE_MB = 10


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/analyze")
async def analyze(file: UploadFile = File(...)):
    """
    Upload a structural section image.
    Returns JSON with corners, line segments, and base64-encoded Excel + DXF files.
    """
    # Validate file type
    mime = file.content_type or ""
    if mime not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {mime}. Use PNG, JPEG, or WebP.",
        )

    image_bytes = await file.read()

    # Validate file size
    if len(image_bytes) > MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"File too large. Max {MAX_FILE_SIZE_MB}MB.")

    # Call Gemini
    try:
        analysis = await analyze_structural_drawing(image_bytes, mime_type=mime)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

    # Generate exports
    excel_bytes = to_excel(analysis)
    dxf_bytes = to_dxf(analysis)

    return JSONResponse({
        "analysis": analysis,
        "exports": {
            "excel_b64": base64.b64encode(excel_bytes).decode(),
            "dxf_b64": base64.b64encode(dxf_bytes).decode(),
        },
    })