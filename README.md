# 📚 Research Paper Analysis Agent

An Agentic RAG system that analyzes research papers using **Gemma 4 E4B** running locally via **Ollama**.

## 🚀 Setup

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Add your research papers
Put your PDF files inside the `papers/` folder.

### 3. Make sure Ollama is running
```bash
ollama serve
```

### 4. Run the agent
```bash
python agent.py
```

### 5. Open browser
Go to → **http://localhost:7860**

---

## 💡 What can it do?
- ✅ Summarize research papers
- ✅ Answer questions about paper content
- ✅ Extract key findings & contributions
- ✅ Identify methodology and results
- ✅ Extract citations and references

## 🗂️ Project Structure
```
research_agent/
├── agent.py          # Main agent code
├── requirements.txt  # Dependencies
├── README.md         # This file
└── papers/           # Put your PDF papers here
```

## 🛠️ Tech Stack
- **LLM:** Gemma 4 E4B (via Ollama - 100% local & free)
- **Framework:** LlamaIndex
- **UI:** Gradio
- **Vector Store:** LlamaIndex default (in-memory)
