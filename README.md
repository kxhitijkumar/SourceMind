---

# SourceMind
### A Local-First, AI-Native Code Editor

SourceMind is a high-performance desktop code editor built for developers who prioritize **privacy**, **speed**, and **deep codebase understanding**. Unlike cloud-based AI assistants, SourceMind operates **entirely offline**, using a local RAG (Retrieval-Augmented Generation) engine and local LLMs to provide context-aware suggestions without your code ever leaving your machine.

---

## Key Features

- **Local-First AI:** Integrated with **Ollama** to run models like `Qwen2.5-Coder` or `DeepSeek-Coder` locally.
- **Deep Codebase Awareness (RAG):** Uses a **FAISS** vector database to index your entire project, allowing the AI to understand cross-file relationships.
- **Inline AI Refactoring:** Select code and invoke AI to transform, optimize, or document it with a side-by-side **Diff Preview**.
- **Native Performance:** Built on **Tauri** and **Rust** for a lightweight memory footprint and system-level file access.
- **Full IDE Essentials:** Recursive file explorer, multi-language syntax highlighting (Monaco Editor), and atomic file operations for safety.

---

## Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React, TypeScript, Monaco Editor, Lucide Icons |
| **Native Layer** | Rust, Tauri |
| **AI Engine** | Python (FastAPI), FAISS, Sentence-Transformers |
| **Local LLM** | Ollama (Qwen2.5-Coder 7B) |

---

## Getting Started

### 1. Prerequisites

Ensure you have the following installed:
*   **Rust:** [rustup.rs](https://rustup.rs/)
*   **Node.js:** (LTS Version)
*   **Python:** 3.10 or higher
*   **Ollama:** [ollama.com](https://ollama.com/)
*   **Tauri Dependencies:** Follow the [Prerequisites Guide](https://tauri.app/v1/guides/getting-started/prerequisites) for your OS (Windows C++ Build Tools, Linux webkit2gtk, etc.)

### 2. Prepare the AI Model
Download and start the LLM via Ollama:
```bash
ollama pull qwen2.5-coder:7b
ollama serve
```

### 3. Setup the AI Backend
Navigate to the backend folder, create a virtual environment, and install dependencies:
```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# Mac/Linux
source venv/bin/activate

pip install -r requirements.txt
python main.py
```
*The backend will run at `http://localhost:8000`.*

### 4. Setup the Desktop App
Open a new terminal in the project root:
```bash
# Install frontend dependencies
npm install

# Run the app in development mode
npm run tauri dev
```

---

## Configuration & Usage

### Opening a Project
1. Click the **"Open Folder"** button in the sidebar.
2. Select your project directory.
3. The AI Status will change to **"Indexing..."** while it generates embeddings for your code. Once finished, it will display **"RAG Ready"**.

### Using Inline AI
1. Open a source file and **highlight a block of code**.
2. In the right-hand **AI Assistant** panel, type your instruction (e.g., *"Convert this to an async function"*).
3. Click **"Apply Transformation"**.
4. Review the changes in the **Diff View**. Click **"Accept"** to commit the changes to your file or **"Reject"** to discard them.

### Creating Files/Folders
*   Use the **File+** or **Folder+** icons in the sidebar to add new resources directly to your directory structure. SourceMind automatically detects the language based on the file extension.

---

## Safety & Privacy Design

*   **Zero Data Leakage:** All AI inference is done via Ollama on your local hardware. No code is sent to external APIs.
*   **Atomic Writes:** SourceMind writes to a temporary file and renames it only after a successful write to prevent file corruption during crashes.
*   **Binary Protection:** The editor automatically detects and blocks the opening of binary files to prevent system instability.

---