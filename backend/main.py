import os
import json
import shutil
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from rag_engine import RAGEngine

PAPERS_DIR = "backend/papers"


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs(PAPERS_DIR, exist_ok=True)
    yield


app = FastAPI(title="Research Paper Analysis Agent", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = RAGEngine(papers_dir=PAPERS_DIR)


class QueryRequest(BaseModel):
    question: str


@app.get("/papers")
def list_papers():
    os.makedirs(PAPERS_DIR, exist_ok=True)
    files = [f for f in os.listdir(PAPERS_DIR) if f.endswith(".pdf")]
    return {"papers": files}


@app.post("/upload")
async def upload_paper(file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are allowed")
    os.makedirs(PAPERS_DIR, exist_ok=True)
    filepath = os.path.join(PAPERS_DIR, file.filename)
    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)
    engine.reindex()
    return {"message": f"{file.filename} uploaded and indexed"}


@app.delete("/papers/{filename}")
def delete_paper(filename: str):
    filepath = os.path.join(PAPERS_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(404, "Paper not found")
    os.remove(filepath)
    engine.reindex()
    return {"message": f"{filename} deleted"}


@app.post("/query")
def query_papers(req: QueryRequest):
    def generate():
        for event in engine.stream_query(req.question):
            yield f"data: {json.dumps(event)}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"
    return StreamingResponse(generate(), media_type="text/event-stream")
