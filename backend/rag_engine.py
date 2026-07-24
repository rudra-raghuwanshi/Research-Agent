import os
import time
import asyncio
import chromadb
from dotenv import load_dotenv
from pydantic import Field
from llama_index.core import VectorStoreIndex, SimpleDirectoryReader, Settings, StorageContext
from llama_index.llms.groq import Groq
from llama_index.embeddings.google_genai import GoogleGenAIEmbedding
from llama_index.vector_stores.chroma import ChromaVectorStore


class RateLimitedGoogleGenAIEmbedding(GoogleGenAIEmbedding):
    batch_delay: float = Field(default=2.5, description="Delay in seconds between embedding batch API calls")

    def _get_text_embeddings(self, texts):
        time.sleep(self.batch_delay)
        return super()._get_text_embeddings(texts)

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

CHROMA_DIR = os.getenv("CHROMA_DIR", "chroma_db")
COLLECTION_NAME = "research_papers"


class RAGEngine:
    def __init__(self, papers_dir: str = "backend/papers", lazy_init: bool = False):
        api_key = os.getenv("GROQ_API_KEY", "")
        if not api_key:
            raise ValueError("GROQ_API_KEY environment variable is not set. Set it in your environment or .env file.")

        self.papers_dir = papers_dir
        self.index = None
        self.ready = False

        Settings.llm = Groq(model="llama-3.3-70b-versatile", api_key=api_key)
        gemini_api_key = os.getenv("GEMINI_API_KEY", "")
        Settings.embed_model = RateLimitedGoogleGenAIEmbedding(
            model_name="gemini-embedding-2",
            api_key=gemini_api_key,
            embed_batch_size=10,
            batch_delay=2.5,
            retries=15,
            timeout=120,
            retry_min_seconds=5,
            retry_max_seconds=120,
            retry_exponential_base=2,
        )

        self.db_client = chromadb.PersistentClient(path=CHROMA_DIR)
        self.chroma_collection = self.db_client.get_or_create_collection(COLLECTION_NAME)
        self.vector_store = ChromaVectorStore(chroma_collection=self.chroma_collection)

        if not lazy_init:
            self._load_or_index()

    def _load_or_index(self):
        if self.chroma_collection.count() > 0:
            try:
                self.index = VectorStoreIndex.from_vector_store(
                    self.vector_store,
                    embed_model=Settings.embed_model,
                )
                print("Loaded index from ChromaDB")
                self.ready = True
            except Exception as e:
                print(f"Failed to load index, re-indexing: {e}")
                self._index_papers()
        else:
            self._index_papers()

    async def initialize(self):
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self._load_or_index)
        self.ready = True
        print("Engine initialization complete")

    def _index_papers(self):
        os.makedirs(self.papers_dir, exist_ok=True)
        pdf_files = [f for f in os.listdir(self.papers_dir) if f.endswith(".pdf")]
        if not pdf_files:
            self.index = None
            return
        print(f"Indexing {len(pdf_files)} paper(s)...")
        documents = SimpleDirectoryReader(self.papers_dir, required_exts=[".pdf"]).load_data()
        storage_context = StorageContext.from_defaults(vector_store=self.vector_store)
        self.index = VectorStoreIndex.from_documents(
            documents,
            storage_context=storage_context,
            embed_model=Settings.embed_model,
        )
        print("Index saved to ChromaDB.")

    def reindex(self):
        try:
            self.db_client.delete_collection(COLLECTION_NAME)
        except ValueError:
            pass
        self.chroma_collection = self.db_client.create_collection(COLLECTION_NAME)
        self.vector_store = ChromaVectorStore(chroma_collection=self.chroma_collection)
        self._index_papers()

    def query(self, question: str) -> str:
        if self.index is None:
            return "No papers indexed. Upload a PDF first."
        try:
            engine = self.index.as_query_engine(similarity_top_k=3, response_mode="compact")
            response = engine.query(question)
            return str(response)
        except Exception as e:
            return f"Error: {str(e)}"

    def stream_query(self, question: str):
        if self.index is None:
            yield {"type": "sources", "sources": []}
            yield {"type": "token", "token": "No papers indexed. Upload a PDF first."}
            return
        try:
            engine = self.index.as_query_engine(
                streaming=True,
                similarity_top_k=3,
                response_mode="compact",
            )
            response = engine.query(question)

            sources = []
            try:
                for node in response.source_nodes:
                    meta = node.node.metadata
                    sources.append({
                        "file": meta.get("file_name", "Unknown"),
                        "page": meta.get("page_label") or meta.get("page"),
                    })
            except Exception:
                pass
            yield {"type": "sources", "sources": sources}

            for chunk in response.response_gen:
                yield {"type": "token", "token": chunk}
        except Exception as e:
            yield {"type": "sources", "sources": []}
            yield {"type": "token", "token": f"Error: {str(e)}"}
