import { useState, useRef, useEffect } from 'react';
import Editor, { DiffEditor } from '@monaco-editor/react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { 
  Folder, FileCode, Search, Sparkles, Save, ShieldCheck, 
  ChevronRight, ChevronDown, FilePlus, FolderPlus, Trash2 
} from 'lucide-react';
import axios from 'axios';

// Utility for Language Detection based on extension
const detectLanguage = (path: string) => {
  const ext = path.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    js: 'javascript', ts: 'typescript', jsx: 'javascript', tsx: 'typescript',
    py: 'python', rs: 'rust', go: 'go', cpp: 'cpp', c: 'c',
    html: 'html', css: 'css', json: 'json', md: 'markdown', yaml: 'yaml',
    sh: 'shell', sql: 'sql'
  };
  return map[ext || ''] || 'plaintext';
};

const FileTreeItem = ({ item, onFileClick, onNewFile, onNewFolder }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const isDir = item.is_dir;

  return (
    <div style={{ userSelect: 'none' }}>
      <div 
        style={{ 
          cursor: 'pointer', display: 'flex', alignItems: 'center', 
          gap: '4px', padding: '4px 8px', borderRadius: '4px',
          justifyContent: 'space-between'
        }}
        className="tree-item-hover"
        onClick={() => isDir ? setIsOpen(!isOpen) : onFileClick(item.path)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {isDir ? (isOpen ? <ChevronDown size={14}/> : <ChevronRight size={14}/>) : <div style={{width: 14}}/>}
          {isDir ? <Folder size={14} color="#eab308" /> : <FileCode size={14} color="#60a5fa" />}
          <span style={{ fontSize: '13px' }}>{item.name}</span>
        </div>
        
        {/* Action icons appear on hover (handled by CSS or conditional rendering) */}
        {isDir && (
          <div style={{ display: 'flex', gap: '4px' }}>
            <FilePlus size={12} onClick={(e) => { e.stopPropagation(); onNewFile(item.path); }} />
            <FolderPlus size={12} onClick={(e) => { e.stopPropagation(); onNewFolder(item.path); }} />
          </div>
        )}
      </div>

      {isDir && isOpen && item.children && (
        <div style={{ paddingLeft: '12px', borderLeft: '1px solid #334155', marginLeft: '12px' }}>
          {item.children.map((child: any) => (
            <FileTreeItem 
              key={child.path} 
              item={child} 
              onFileClick={onFileClick}
              onNewFile={onNewFile}
              onNewFolder={onNewFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Simple wrapper component to render the root file tree.
 */
const FileTree = ({ items, onFileClick, onNewFile, onNewFolder }: any) => {
  if (!items || items.length === 0) {
    return (
      <div style={{ padding: '8px', color: '#64748b' }}>
        No files found
      </div>
    );
  }
  return (
    <div>
      {items.map((item: any) => (
        <FileTreeItem
          key={item.path}
          item={item}
          onFileClick={onFileClick}
          onNewFile={onNewFile}
          onNewFolder={onNewFolder}
        />
      ))}
    </div>
  );
};

export default function App() {
  const [tree, setTree] = useState([]);
  const [rootPath, setRootPath] = useState("");
  const [currentPath, setCurrentPath] = useState("");
  const [code, setCode] = useState("");
  const [originalCode, setOriginalCode] = useState("");
  const [modifiedCode, setModifiedCode] = useState("");
  const [isDiffMode, setIsDiffMode] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("No Project");

  const editorRef = useRef<any>(null);

  useEffect(() => { setIsDirty(code !== originalCode); }, [code, originalCode]);

  const refreshTree = async (path = rootPath) => {
    if (!path) return;
    const result = await invoke('get_directory_tree', { path });
    setTree(result as any);
  };

  const handleOpenFolder = async () => {
    const selected = await open({ directory: true });
    if (selected && typeof selected === 'string') {
      setRootPath(selected);
      setStatus("Indexing...");
      refreshTree(selected);
      await axios.post('http://localhost:8000/index_project', { path: selected });
      setStatus("RAG Ready");
    }
  };

  const handleNewFile = async (parentPath: string) => {
    const name = window.prompt("Enter file name (e.g. main.py):");
    if (!name) return;
    try {
      const fullPath = `${parentPath}/${name}`;
      await invoke('create_file', { path: fullPath });
      refreshTree();
    } catch (e) { alert(e); }
  };

  const handleNewFolder = async (parentPath: string) => {
    const name = window.prompt("Enter folder name:");
    if (!name) return;
    try {
      const fullPath = `${parentPath}/${name}`;
      await invoke('create_dir', { path: fullPath });
      refreshTree();
    } catch (e) { alert(e); }
  };

  const handleFileClick = async (path: string) => {
    const res: any = await invoke('read_file_safe', { path });
    if (res.is_binary) return alert("Binary file!");
    setCurrentPath(path);
    setCode(res.content);
    setOriginalCode(res.content);
    setIsDiffMode(false);
  };

  const handleSave = async () => {
    await invoke('write_file_atomic', { path: currentPath, content: code });
    setOriginalCode(code);
    setIsDirty(false);
  };

  const handleInlineEdit = async () => {
    const selection = editorRef.current?.getSelection();
    const selectedText = editorRef.current?.getModel()?.getValueInRange(selection);
    if (!selectedText) return alert("Select code first!");
    setIsLoading(true);
    try {
      const res = await axios.post('http://localhost:8000/edit_inline', {
        instruction: prompt, selected_code: selectedText, file_context: code
      });
      setModifiedCode(code.replace(selectedText, res.data.modified_code));
      setIsDiffMode(true);
    } catch (e) { alert("AI Offline"); }
    setIsLoading(false);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0f172a', color: '#cbd5e1', fontFamily: 'Inter, sans-serif' }}>
      
      {/* Sidebar */}
      <div style={{ width: '280px', background: '#111827', borderRight: '1px solid #1e293b', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleOpenFolder} style={{ flex: 1, background: '#3b82f6', color: 'white', padding: '8px', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Search size={14}/> Project
            </button>
            {rootPath && (
              <>
                <button title="New File at Root" onClick={() => handleNewFile(rootPath)} style={{ background: '#1e293b', border: '1px solid #334155', color: 'white', padding: '8px', borderRadius: '4px', cursor: 'pointer' }}><FilePlus size={14}/></button>
                <button title="New Folder at Root" onClick={() => handleNewFolder(rootPath)} style={{ background: '#1e293b', border: '1px solid #334155', color: 'white', padding: '8px', borderRadius: '4px', cursor: 'pointer' }}><FolderPlus size={14}/></button>
              </>
            )}
          </div>
          <div style={{ marginTop: '10px', fontSize: '11px', color: '#64748b' }}>
            <ShieldCheck size={12} /> {status}
          </div>
        </div>
        <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
          <FileTree 
            items={tree} 
            onFileClick={handleFileClick} 
            onNewFile={handleNewFile}
            onNewFolder={handleNewFolder}
          />
        </div>
      </div>

      {/* Editor Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: '45px', background: '#0f172a', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 15px' }}>
          <div style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
             <span style={{ color: '#64748b' }}>{detectLanguage(currentPath).toUpperCase()}</span>
             <span style={{ color: '#fff' }}>{currentPath.split(/[\\/]/).pop() || "SourceMind"}</span>
             {isDirty && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3b82f6' }} />}
          </div>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            {isDiffMode ? (
              <>
                <button onClick={() => { setCode(modifiedCode); setIsDiffMode(false); }} style={{ background: '#22c55e', border: 'none', color: 'white', padding: '0 12px', borderRadius: '4px', height: '28px', cursor: 'pointer' }}>Accept</button>
                <button onClick={() => setIsDiffMode(false)} style={{ background: '#ef4444', border: 'none', color: 'white', padding: '0 12px', borderRadius: '4px', height: '28px', cursor: 'pointer' }}>Reject</button>
              </>
            ) : (
              <button onClick={handleSave} disabled={!isDirty} style={{ opacity: isDirty ? 1 : 0.5, background: 'transparent', border: '1px solid #334155', color: 'white', padding: '12px', borderRadius: '4px', height: '28px' }}>
                <Save size={14} />
              </button>
            )}
          </div>
        </div>

        <div style={{ flex: 1 }}>
          {isDiffMode ? (
            <DiffEditor 
              original={code} 
              modified={modifiedCode} 
              language={detectLanguage(currentPath)} 
              theme="vs-dark" 
            />
          ) : (
            <Editor 
              height="100%" 
              theme="vs-dark" 
              language={detectLanguage(currentPath)} 
              value={code} 
              onMount={(ed) => editorRef.current = ed} 
              onChange={(v) => setCode(v || "")} 
            />
          )}
        </div>
      </div>

      {/* AI Panel */}
      <div style={{ width: '320px', background: '#0f172a', borderLeft: '1px solid #1e293b', padding: '20px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold', marginBottom: '20px' }}>
          <Sparkles size={18} color="#60a5fa" /> AI Assistant
        </div>
        <textarea 
          value={prompt} 
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Refactor selection (e.g. 'convert to arrow function')..."
          style={{ width: '100%', height: '140px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: 'white', padding: '12px', outline: 'none', resize: 'none' }}
        />
        <button 
          onClick={handleInlineEdit} 
          disabled={isLoading}
          style={{ width: '100%', marginTop: '15px', padding: '12px', background: isLoading ? '#334155' : '#3b82f6', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
        >
          {isLoading ? "Thinking..." : "Apply Transformation"}
        </button>
      </div>
    </div>
  );
}