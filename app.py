import io, sys, os, json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")

from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from llama_index.core import VectorStoreIndex, SimpleDirectoryReader, Settings, StorageContext, load_index_from_storage
from llama_index.llms.ollama import Ollama
from llama_index.embeddings.ollama import OllamaEmbedding
import ollama as ollama_client

PAPERS_DIR = "papers"
STORAGE_DIR = "storage"
OLLAMA_MODEL = "gemma2:2b"
OLLAMA_BASE = "http://localhost:11434"
PORT = 8000

Settings.llm = Ollama(model=OLLAMA_MODEL, base_url=OLLAMA_BASE, request_timeout=300.0)
Settings.embed_model = OllamaEmbedding(model_name="nomic-embed-text", base_url=OLLAMA_BASE)

app = FastAPI(title="Research Paper Analysis Agent")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

index = None


def build_index():
    global index
    os.makedirs(PAPERS_DIR, exist_ok=True)
    pdfs = [f for f in os.listdir(PAPERS_DIR) if f.lower().endswith(".pdf")]
    if not pdfs:
        index = None
        return
    print(f"Indexing {len(pdfs)} paper(s)...")
    docs = SimpleDirectoryReader(PAPERS_DIR, required_exts=[".pdf"]).load_data()
    index = VectorStoreIndex.from_documents(docs)
    os.makedirs(STORAGE_DIR, exist_ok=True)
    index.storage_context.persist(persist_dir=STORAGE_DIR)
    print("Index ready.")


if os.path.exists(STORAGE_DIR):
    try:
        ctx = StorageContext.from_defaults(persist_dir=STORAGE_DIR)
        index = load_index_from_storage(ctx)
    except Exception:
        build_index()
else:
    build_index()

conversations: dict[str, list] = {}


class QueryRequest(BaseModel):
    question: str
    session_id: str = "default"


@app.get("/api/papers")
def list_papers():
    os.makedirs(PAPERS_DIR, exist_ok=True)
    files = sorted([f for f in os.listdir(PAPERS_DIR) if f.lower().endswith(".pdf")])
    return {"papers": files}


@app.post("/api/upload")
async def upload_paper(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are allowed")
    os.makedirs(PAPERS_DIR, exist_ok=True)
    filepath = os.path.join(PAPERS_DIR, file.filename)
    with open(filepath, "wb") as f:
        f.write(await file.read())
    build_index()
    return {"message": f"{file.filename} uploaded and indexed", "filename": file.filename}


@app.delete("/api/papers/{filename}")
def delete_paper(filename: str):
    filepath = os.path.join(PAPERS_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(404, "Paper not found")
    os.remove(filepath)
    build_index()
    return {"message": f"{filename} deleted"}


def build_context(question: str, session_id: str) -> str:
    if index is None:
        return ""
    try:
        engine = index.as_query_engine(similarity_top_k=3, response_mode="compact")
        response = engine.query(question)
        return str(response)
    except Exception:
        return ""


@app.post("/api/query")
async def query_papers(req: QueryRequest):
    if index is None:
        async def empty():
            yield json.dumps({"token": "", "done": True, "sources": []})
        return StreamingResponse(empty(), media_type="text/event-stream")

    session_id = req.session_id or "default"
    if session_id not in conversations:
        conversations[session_id] = []

    conversations[session_id].append({"role": "user", "content": req.question})

    context = build_context(req.question, session_id)

    sources = []
    if index:
        try:
            retriever = index.as_retriever(similarity_top_k=3)
            nodes = retriever.retrieve(req.question)
            for node in nodes:
                if hasattr(node, "metadata") and "file_name" in node.metadata:
                    sources.append(node.metadata["file_name"])
            sources = list(set(sources))
        except Exception:
            pass

    system_prompt = (
        "You are a research paper analysis assistant. "
        "Answer the user's question based on the following context from research papers. "
        "Be concise and direct. If the context doesn't contain the answer, say so.\n\n"
        f"Context:\n{context}\n\n"
    )

    messages = [{"role": "system", "content": system_prompt}]
    for msg in conversations[session_id][:-1]:
        messages.append(msg)
    messages.append({"role": "user", "content": req.question})

    async def generate():
        full_answer = ""
        try:
            stream = ollama_client.chat(
                model=OLLAMA_MODEL,
                messages=messages,
                stream=True,
            )
            for chunk in stream:
                token = chunk["message"]["content"]
                full_answer += token
                yield json.dumps({"token": token, "done": False}) + "\n"
        except Exception as e:
            yield json.dumps({"token": f"Error: {str(e)}", "done": True, "sources": []}) + "\n"
            return

        conversations[session_id].append({"role": "assistant", "content": full_answer})
        yield json.dumps({"token": "", "done": True, "sources": sources}) + "\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@app.delete("/api/history/{session_id}")
def clear_history(session_id: str):
    conversations.pop(session_id, None)
    return {"message": "History cleared"}


app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
def serve_frontend():
    return FileResponse("static/index.html")


if __name__ == "__main__":
    import uvicorn
    print(f"\nStarting server at http://localhost:{PORT}")
    print(f"Model: {OLLAMA_MODEL} (fast)")
    print(f"Papers folder: {os.path.abspath(PAPERS_DIR)}\n")
    uvicorn.run(app, host="0.0.0.0", port=PORT)
