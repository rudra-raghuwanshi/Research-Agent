import io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")

from llama_index.core import VectorStoreIndex, SimpleDirectoryReader, Settings
from llama_index.llms.ollama import Ollama
from llama_index.embeddings.ollama import OllamaEmbedding
import gradio as gr
import os

# ─── Configuration ───────────────────────────────────────────────────────────
PAPERS_DIR = "papers"
OLLAMA_MODEL = "gemma4:e4b"
OLLAMA_BASE = "http://localhost:11434"

# ─── Setup LLM & Embeddings ──────────────────────────────────────────────────
llm = Ollama(model=OLLAMA_MODEL, base_url=OLLAMA_BASE, request_timeout=120.0)
embed_model = OllamaEmbedding(model_name="nomic-embed-text", base_url=OLLAMA_BASE)

Settings.llm = llm
Settings.embed_model = embed_model

# ─── Load & Index Papers ─────────────────────────────────────────────────────
def load_papers():
    if not os.path.exists(PAPERS_DIR):
        os.makedirs(PAPERS_DIR)
    pdf_files = [f for f in os.listdir(PAPERS_DIR) if f.endswith(".pdf")]
    if not pdf_files:
        return None, "⚠️ No PDFs found in the 'papers/' folder."
    print(f"📄 Loading {len(pdf_files)} paper(s): {pdf_files}")
    documents = SimpleDirectoryReader(PAPERS_DIR, required_exts=[".pdf"]).load_data()
    index = VectorStoreIndex.from_documents(documents)
    print("✅ Papers indexed successfully!")
    return index, f"✅ Loaded {len(pdf_files)} paper(s): {', '.join(pdf_files)}"

# ─── Build Query Engine ──────────────────────────────────────────────────────
def build_query_engine(index):
    return index.as_query_engine(
        similarity_top_k=5,
        response_mode="tree_summarize",
    )

# ─── Initialize ──────────────────────────────────────────────────────────────
index, status_msg = load_papers()
query_engine = build_query_engine(index) if index else None

# ─── Chat Function ───────────────────────────────────────────────────────────
def chat(message, history):
    if query_engine is None:
        return "⚠️ No papers loaded. Please add PDF files to the 'papers/' folder and restart."
    try:
        response = query_engine.query(message)
        return str(response)
    except Exception as e:
        return f"❌ Error: {str(e)}"

# ─── Gradio UI ───────────────────────────────────────────────────────────────
with gr.Blocks(title="Research Paper Analysis Agent") as demo:
    gr.Markdown("# 📚 Research Paper Analysis Agent")
    gr.Markdown(f"**Status:** {status_msg}")
    gr.Markdown("**Powered by:** Gemma 4 E4B (Local) + LlamaIndex")
    gr.Markdown("""
    ### 💡 Example Questions:
    - *"Summarize the main contributions of the paper"*
    - *"What methodology did the authors use?"*
    - *"Extract all citations from the paper"*
    - *"What were the key findings and results?"*
    - *"What problem does this paper solve?"*
    """)
    gr.ChatInterface(
        fn=chat,
        chatbot=gr.Chatbot(height=450),
        textbox=gr.Textbox(placeholder="Ask anything about your research papers...", scale=7),
    )

if __name__ == "__main__":
    print("\n🚀 Starting Research Paper Analysis Agent...")
    print(f"📂 Papers folder: {os.path.abspath(PAPERS_DIR)}")
    print("🌐 Opening browser at http://localhost:7860\n")
    demo.launch(show_error=True, theme=gr.themes.Soft())