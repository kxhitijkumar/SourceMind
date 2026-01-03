from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware # Import this
from pydantic import BaseModel
import ollama
import faiss
import numpy as np
import os
from sentence_transformers import SentenceTransformer
from langchain_text_splitters import RecursiveCharacterTextSplitter

app = FastAPI()

# --- ADD THIS CORS SECTION ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allows all origins (Tauri, localhost, etc.)
    allow_credentials=True,
    allow_methods=["*"], # Allows POST, GET, OPTIONS, etc.
    allow_headers=["*"], # Allows all headers
)
# ------------------------------

model = SentenceTransformer('all-MiniLM-L6-v2')
index = faiss.IndexFlatL2(384)
documents = []
splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=100,
    separators=["\ndef ", "\nclass ", "\n\n", "\n", " "]
)

class Query(BaseModel):
    prompt: str
    context_code: str = ""

class EditRequest(BaseModel):
    instruction: str
    selected_code: str
    file_context: str

@app.post("/edit_inline")
async def edit_inline(req: EditRequest):
    prompt = f"""
    You are an expert refactoring engine. 
    INSTRUCTION: {req.instruction}
    
    ORIGINAL CODE TO MODIFY:
    ```
    {req.selected_code}
    ```
    
    FILE CONTEXT FOR REFERENCE:
    {req.file_context}
    
    TASK: Rewrite the 'ORIGINAL CODE TO MODIFY' based on the instruction.
    CRITICAL: Output ONLY the new code. No explanations, no markdown backticks, no preamble.
    """
    
    response = ollama.generate(model='qwen2.5-coder:7b', prompt=prompt)
    # Clean up any accidental markdown backticks from the LLM
    clean_code = response['response'].strip().replace("```python", "").replace("```", "")
    return {"modified_code": clean_code}

@app.post("/index_project")
async def index_project(data: dict):
    project_path = data.get('path')
    if not project_path or not os.path.exists(project_path):
        raise HTTPException(status_code=400, detail="Invalid path")
    
    global documents
    documents = [] 
    
    indexed_files = 0
    for root, _, files in os.walk(project_path):
        for file in files:
            if file.endswith(('.py', '.js', '.ts', '.rs', '.cpp', '.txt', '.tsx', '.json')):
                full_path = os.path.join(root, file)
                try:
                    with open(full_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        chunks = splitter.split_text(content)
                        for chunk in chunks:
                            doc_entry = f"File: {file}\nContent: {chunk}"
                            documents.append(doc_entry)
                            embedding = model.encode([doc_entry])
                            index.add(np.array(embedding))
                    indexed_files += 1
                except Exception as e:
                    print(f"Error indexing {file}: {e}")
                    continue
                    
    return {"status": "success", "files_indexed": indexed_files}

@app.post("/ask")
async def ask_ai(query: Query):
    # RAG Retrieval
    query_vector = model.encode([query.prompt])
    
    # Ensure index isn't empty
    if index.ntotal == 0:
        retrieved_context = "No project files indexed yet."
    else:
        D, I = index.search(np.array(query_vector), k=3)
        retrieved_context = ""
        for idx in I[0]:
            if idx < len(documents) and idx != -1:
                retrieved_context += documents[idx] + "\n---\n"

    full_prompt = f"""
    You are SourceMind AI, a specialized coding assistant.
    Use the context below from the user's project to answer.
    
    PROJECT CONTEXT:
    {retrieved_context}
    
    CURRENT EDITOR CODE:
    {query.context_code}
    
    USER QUESTION:
    {query.prompt}
    """
    
    try:
        response = ollama.generate(model='qwen2.5-coder:7b', prompt=full_prompt)
        return {"response": response['response']}
    except Exception as e:
        return {"response": f"Ollama Error: {str(e)}. Make sure Ollama is running."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)