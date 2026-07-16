import os
import json
import shutil
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from backend.rag_engine import RAGEngine

PAPERS_DIR = "backend/papers"


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs(PAPERS_DIR, exist_ok=True)
    engine = RAGEngine(papers_dir=PAPERS_DIR, lazy_init=True)
    app.state.engine = engine
    loop = asyncio.get_event_loop()
    loop.create_task(engine.initialize())
    print("Backend ready — engine initializing in background")
    yield


app = FastAPI(title="Research Paper Analysis Agent", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class QueryRequest(BaseModel):
    question: str


@app.get("/health")
async def health_check():
    engine = app.state.engine
    return {
        "status": "ok",
        "engine_ready": engine.ready if hasattr(engine, 'ready') else False,
    }


@app.get("/papers")
async def list_papers():
    os.makedirs(PAPERS_DIR, exist_ok=True)
    loop = asyncio.get_event_loop()
    files = await loop.run_in_executor(None, lambda: [f for f in os.listdir(PAPERS_DIR) if f.endswith(".pdf")])
    return {"papers": files}


@app.post("/upload")
async def upload_paper(file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are allowed")
    os.makedirs(PAPERS_DIR, exist_ok=True)
    filepath = os.path.join(PAPERS_DIR, file.filename)
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, lambda: _save_file(filepath, file))
    await loop.run_in_executor(None, app.state.engine.reindex)
    return {"message": f"{file.filename} uploaded and indexed"}


def _save_file(filepath: str, file: UploadFile):
    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)


@app.delete("/papers/{filename}")
async def delete_paper(filename: str):
    filepath = os.path.join(PAPERS_DIR, filename)
    loop = asyncio.get_event_loop()
    exists = await loop.run_in_executor(None, lambda: os.path.exists(filepath))
    if not exists:
        raise HTTPException(404, "Paper not found")
    await loop.run_in_executor(None, os.remove, filepath)
    await loop.run_in_executor(None, app.state.engine.reindex)
    return {"message": f"{filename} deleted"}


@app.post("/query")
async def query_papers(req: QueryRequest):
    engine = app.state.engine

    def generate():
        for event in engine.stream_query(req.question):
            yield f"data: {json.dumps(event)}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
