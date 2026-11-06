import React, { useState, useEffect, useRef } from 'react';
import { 
  Folder, FileText, ChevronRight, Save, Trash2, 
  Plus, Upload, ArrowLeft, RefreshCw, FileCode, Check, 
  AlertCircle, Settings, Download, Archive, FolderPlus, Edit3, X, FileArchive
} from 'lucide-react';
import { MinecraftServer, FileEntry } from '../types';
import { api } from '../services/api';

interface FileManagerViewProps {
  server: MinecraftServer;
}

export const FileManagerView: React.FC<FileManagerViewProps> = ({ server }) => {
  const [currentPath, setCurrentPath] = useState('');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [initialContent, setInitialContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeEditorMode, setActiveEditorMode] = useState<'visual' | 'raw'>('raw');

  // Modals state
  const [renameModalItem, setRenameModalItem] = useState<FileEntry | null>(null);
  const [renameNewName, setRenameNewName] = useState('');
  const [newFolderModal, setNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFileModal, setNewFileModal] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  // Parsed server.properties for visual mode
  const [propertiesState, setPropertiesState] = useState<Record<string, string>>({});

  const uploadInputRef = useRef<HTMLInputElement>(null);

  const loadFiles = async (path = currentPath) => {
    setLoading(true);
    try {
      const list = await api.listFiles(server.id, path);
      setFiles(list || []);
    } catch (err) {
      console.error(err);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles(currentPath);
  }, [server.id, currentPath]);

  // Keyboard shortcut Ctrl+S / Cmd+S for saving in editor
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        if (editingFile) {
          e.preventDefault();
          handleSave();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingFile, fileContent]);

  const handleOpenFolder = (folderName: string) => {
    const next = currentPath ? `${currentPath}/${folderName}` : folderName;
    setCurrentPath(next);
  };

  const handleOpenFile = async (file: FileEntry) => {
    try {
      setLoading(true);
      const res = await api.readFile(server.id, file.path);
      setEditingFile(file.path);
      setFileContent(res.content);
      setInitialContent(res.content);

      if (file.name === 'server.properties') {
        parseProperties(res.content);
        setActiveEditorMode('visual');
      } else {
        setActiveEditorMode('raw');
      }
    } catch (err: any) {
      alert(`Error reading file: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const parseProperties = (raw: string) => {
    const map: Record<string, string> = {};
    raw.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [k, ...v] = trimmed.split('=');
        if (k) map[k.trim()] = v.join('=').trim();
      }
    });
    setPropertiesState(map);
  };

  const updateProperty = (key: string, value: string) => {
    const updated = { ...propertiesState, [key]: value };
    setPropertiesState(updated);

    // Sync back to raw file content
    const lines = fileContent.split('\n');
    let found = false;
    const newLines = lines.map((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [k] = trimmed.split('=');
        if (k.trim() === key) {
          found = true;
          return `${key}=${value}`;
        }
      }
      return line;
    });

    if (!found) {
      newLines.push(`${key}=${value}`);
    }

    setFileContent(newLines.join('\n'));
  };

  const handleSave = async () => {
    if (!editingFile) return;
    setSaving(true);
    try {
      await api.writeFile(server.id, editingFile, fileContent);
      setInitialContent(fileContent);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: any) {
      alert(`Failed to save: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (filePath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete ${filePath}?`)) return;

    try {
      await api.deleteFile(server.id, filePath);
      loadFiles();
      if (editingFile === filePath) {
        setEditingFile(null);
      }
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    const fullPath = currentPath ? `${currentPath}/${newFolderName.trim()}` : newFolderName.trim();
    setActionBusy(true);
    try {
      await api.createDirectory(server.id, fullPath);
      setNewFolderModal(false);
      setNewFolderName('');
      loadFiles();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionBusy(false);
    }
  };

  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;

    const fullPath = currentPath ? `${currentPath}/${newFileName.trim()}` : newFileName.trim();
    setActionBusy(true);
    try {
      await api.createFile(server.id, fullPath, `# New file: ${newFileName.trim()}\n`);
      setNewFileModal(false);
      setNewFileName('');
      loadFiles();
      setEditingFile(fullPath);
      setFileContent(`# New file: ${newFileName.trim()}\n`);
      setInitialContent(`# New file: ${newFileName.trim()}\n`);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionBusy(false);
    }
  };

  const handleRenameConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameModalItem || !renameNewName.trim()) return;

    setActionBusy(true);
    try {
      await api.renameFile(server.id, renameModalItem.path, renameNewName.trim());
      setRenameModalItem(null);
      setRenameNewName('');
      loadFiles();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionBusy(false);
    }
  };

  const handleZip = async (file: FileEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    setActionBusy(true);
    try {
      await api.zipFiles(server.id, file.path);
      loadFiles();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionBusy(false);
    }
  };

  const handleUnzip = async (file: FileEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Extract archive ${file.name} into the current folder?`)) return;

    setActionBusy(true);
    try {
      await api.unzipFiles(server.id, file.path, currentPath);
      loadFiles();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionBusy(false);
    }
  };

  const handleUploadFiles = async (filesToUpload: FileList | File[]) => {
    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i];
      try {
        await api.uploadFile(server.id, file, currentPath);
      } catch (err: any) {
        alert(`Failed to upload ${file.name}: ${err.message}`);
      }
    }
    loadFiles();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFiles(e.dataTransfer.files);
    }
  };

  const isDirty = editingFile && fileContent !== initialContent;
  const pathParts = currentPath.split('/').filter(Boolean);
  const lineCount = fileContent.split('\n').length;

  return (
    <div 
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className="bg-[#111622] border border-slate-800 rounded-lg overflow-hidden shadow-lg relative"
    >
      {/* Drag Over Overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-30 bg-emerald-950/80 border-2 border-dashed border-emerald-400 flex flex-col items-center justify-center pointer-events-none">
          <Upload className="w-10 h-10 text-emerald-300 animate-bounce mb-2" />
          <span className="text-sm font-bold text-white">Drop files to upload to /{currentPath || 'root'}</span>
        </div>
      )}

      {/* File Manager Toolbar / Breadcrumbs */}
      <div className="px-4 py-3 bg-[#0d121c] border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        {/* Breadcrumb Path */}
        <div className="flex items-center gap-1.5 text-xs font-mono text-slate-300">
          <button
            onClick={() => {
              setCurrentPath('');
              setEditingFile(null);
            }}
            className="hover:text-emerald-400 font-semibold"
          >
            /data
          </button>
          {pathParts.map((part, index) => {
            const sub = pathParts.slice(0, index + 1).join('/');
            return (
              <React.Fragment key={sub}>
                <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                <button
                  onClick={() => {
                    setCurrentPath(sub);
                    setEditingFile(null);
                  }}
                  className="hover:text-emerald-400"
                >
                  {part}
                </button>
              </React.Fragment>
            );
          })}
          {editingFile && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <span>{editingFile.split('/').pop()}</span>
                {isDirty && (
                  <span className="text-[10px] text-amber-400 font-normal">● (Unsaved)</span>
                )}
              </span>
            </>
          )}
        </div>

        {/* Toolbar Buttons */}
        <div className="flex items-center gap-2">
          {editingFile ? (
            <>
              {editingFile.endsWith('server.properties') && (
                <div className="flex items-center bg-[#151c2c] border border-slate-800 rounded p-0.5 text-xs">
                  <button
                    onClick={() => setActiveEditorMode('visual')}
                    className={`px-2 py-1 rounded transition-colors ${
                      activeEditorMode === 'visual' ? 'bg-emerald-500/20 text-emerald-300 font-semibold' : 'text-slate-400'
                    }`}
                  >
                    Visual GUI
                  </button>
                  <button
                    onClick={() => setActiveEditorMode('raw')}
                    className={`px-2 py-1 rounded transition-colors ${
                      activeEditorMode === 'raw' ? 'bg-emerald-500/20 text-emerald-300 font-semibold' : 'text-slate-400'
                    }`}
                  >
                    Raw Config
                  </button>
                </div>
              )}

              <span className="text-[11px] font-mono text-slate-500 hidden sm:inline">
                Ctrl+S to save
              </span>

              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded transition-colors shadow-sm"
              >
                {saveSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>{saving ? 'Saving...' : 'Save File'}</span>
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  if (isDirty && !confirm('Discard unsaved changes?')) return;
                  setEditingFile(null);
                }}
                className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 rounded transition-colors"
              >
                Close
              </button>
            </>
          ) : (
            <>
              <input
                type="file"
                ref={uploadInputRef}
                multiple
                onChange={(e) => e.target.files && handleUploadFiles(e.target.files)}
                className="hidden"
              />

              <button
                onClick={() => uploadInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded transition-colors"
              >
                <Upload className="w-3.5 h-3.5 text-slate-400" />
                <span>Upload</span>
              </button>

              <button
                onClick={() => setNewFileModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New File</span>
              </button>

              <button
                onClick={() => setNewFolderModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded transition-colors"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>New Folder</span>
              </button>

              <button
                onClick={() => loadFiles()}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                title="Refresh Directory"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Body: Either Code Editor or File Table */}
      {editingFile ? (
        <div className="p-4">
          {activeEditorMode === 'visual' && editingFile.endsWith('server.properties') ? (
            <div className="space-y-6">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-md text-xs text-emerald-300 flex items-center gap-2">
                <Settings className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Visual properties syncs instantly with the raw file. Changes take effect on next server restart.</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="md:col-span-2 lg:col-span-3 p-3.5 bg-[#0e131f] border border-slate-800 rounded-lg">
                  <label className="block text-xs font-medium text-slate-300 mb-1">Server MOTD (Message of the Day)</label>
                  <input
                    type="text"
                    value={propertiesState['motd'] || ''}
                    onChange={(e) => updateProperty('motd', e.target.value)}
                    className="w-full bg-[#151c2c] border border-slate-700 text-sm font-mono text-white rounded px-3 py-1.5 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="p-3.5 bg-[#0e131f] border border-slate-800 rounded-lg">
                  <label className="block text-xs font-medium text-slate-300 mb-1">Server Port</label>
                  <input
                    type="number"
                    value={propertiesState['server-port'] || server.port}
                    onChange={(e) => updateProperty('server-port', e.target.value)}
                    className="w-full bg-[#151c2c] border border-slate-700 text-sm font-mono text-white rounded px-3 py-1.5 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="p-3.5 bg-[#0e131f] border border-slate-800 rounded-lg">
                  <label className="block text-xs font-medium text-slate-300 mb-1">Max Players</label>
                  <input
                    type="number"
                    value={propertiesState['max-players'] || '20'}
                    onChange={(e) => updateProperty('max-players', e.target.value)}
                    className="w-full bg-[#151c2c] border border-slate-700 text-sm font-mono text-white rounded px-3 py-1.5 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="p-3.5 bg-[#0e131f] border border-slate-800 rounded-lg">
                  <label className="block text-xs font-medium text-slate-300 mb-1">Difficulty</label>
                  <select
                    value={propertiesState['difficulty'] || 'normal'}
                    onChange={(e) => updateProperty('difficulty', e.target.value)}
                    className="w-full bg-[#151c2c] border border-slate-700 text-sm font-mono text-white rounded px-3 py-1.5 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="peaceful">Peaceful</option>
                    <option value="easy">Easy</option>
                    <option value="normal">Normal</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>

                <div className="p-3.5 bg-[#0e131f] border border-slate-800 rounded-lg">
                  <label className="block text-xs font-medium text-slate-300 mb-1">Default Game Mode</label>
                  <select
                    value={propertiesState['gamemode'] || 'survival'}
                    onChange={(e) => updateProperty('gamemode', e.target.value)}
                    className="w-full bg-[#151c2c] border border-slate-700 text-sm font-mono text-white rounded px-3 py-1.5 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="survival">Survival</option>
                    <option value="creative">Creative</option>
                    <option value="adventure">Adventure</option>
                    <option value="spectator">Spectator</option>
                  </select>
                </div>

                <div className="p-3.5 bg-[#0e131f] border border-slate-800 rounded-lg">
                  <label className="block text-xs font-medium text-slate-300 mb-1">View Distance (Chunks)</label>
                  <input
                    type="number"
                    value={propertiesState['view-distance'] || '10'}
                    onChange={(e) => updateProperty('view-distance', e.target.value)}
                    className="w-full bg-[#151c2c] border border-slate-700 text-sm font-mono text-white rounded px-3 py-1.5 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="border border-slate-800 rounded-lg overflow-hidden bg-[#0a0d14]">
              {/* Editor Header Info */}
              <div className="px-3 py-1.5 bg-[#0e131f] border-b border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>{editingFile}</span>
                <span>{lineCount} lines</span>
              </div>

              {/* Code Editor with Line Numbers */}
              <div className="flex font-mono text-xs text-slate-200">
                <div className="py-3 px-2 bg-[#0e131f]/70 border-r border-slate-800/80 select-none text-right text-slate-600 font-mono">
                  {Array.from({ length: lineCount }).map((_, i) => (
                    <div key={i} className="leading-relaxed px-1">
                      {i + 1}
                    </div>
                  ))}
                </div>

                <textarea
                  value={fileContent}
                  onChange={(e) => setFileContent(e.target.value)}
                  rows={24}
                  className="flex-1 bg-transparent p-3 font-mono text-xs text-slate-200 leading-relaxed focus:outline-none resize-y selection:bg-emerald-500/30"
                  spellCheck={false}
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-500 font-mono">
              Reading server filesystem...
            </div>
          ) : files.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500">
              This folder is empty. Drag and drop files or click &quot;Upload&quot;.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0e131f] border-b border-slate-800 text-slate-400 font-mono">
                <tr>
                  <th className="py-2.5 px-4 font-medium">Name</th>
                  <th className="py-2.5 px-4 font-medium text-right">Size</th>
                  <th className="py-2.5 px-4 font-medium text-right">Last Modified</th>
                  <th className="py-2.5 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {files.map((file) => {
                  const isZip = file.name.endsWith('.zip') || file.name.endsWith('.tar.gz');
                  return (
                    <tr
                      key={file.path}
                      onClick={() => (file.isDirectory ? handleOpenFolder(file.name) : handleOpenFile(file))}
                      className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                    >
                      <td className="py-2.5 px-4 flex items-center gap-2.5 text-slate-200 font-medium">
                        {file.isDirectory ? (
                          <Folder className="w-4 h-4 text-amber-400 fill-amber-400/20 shrink-0" />
                        ) : isZip ? (
                          <FileArchive className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : file.name === 'server.properties' ? (
                          <Settings className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : file.extension === 'yml' || file.extension === 'json' || file.extension === 'sk' ? (
                          <FileCode className="w-4 h-4 text-sky-400 shrink-0" />
                        ) : (
                          <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                        <span className="font-mono text-xs">{file.name}</span>
                      </td>

                      <td className="py-2.5 px-4 text-right font-mono text-slate-400 tabular-nums">
                        {file.isDirectory ? '-' : `${(file.size / 1024).toFixed(1)} KB`}
                      </td>

                      <td className="py-2.5 px-4 text-right font-mono text-slate-500 tabular-nums">
                        {new Date(file.updatedAt).toLocaleDateString()} {new Date(file.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>

                      <td className="py-2.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          {/* Unzip action for archives */}
                          {isZip && (
                            <button
                              onClick={(e) => handleUnzip(file, e)}
                              title="Extract archive into current directory"
                              className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition-colors"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Zip action for files/directories */}
                          {!isZip && (
                            <button
                              onClick={(e) => handleZip(file, e)}
                              title="Compress into .zip archive"
                              className="p-1 text-slate-400 hover:text-sky-400 hover:bg-slate-800 rounded transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Direct Download */}
                          {!file.isDirectory && (
                            <a
                              href={api.getDownloadUrl(server.id, file.path)}
                              download={file.name}
                              title="Download file"
                              className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          )}

                          {/* Rename */}
                          <button
                            onClick={() => {
                              setRenameModalItem(file);
                              setRenameNewName(file.name);
                            }}
                            title="Rename"
                            className="p-1 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={(e) => handleDelete(file.path, e)}
                            title="Delete"
                            className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Rename Modal */}
      {renameModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <form onSubmit={handleRenameConfirm} className="w-full max-w-sm bg-[#0e1320] border border-slate-800 rounded-xl p-5 space-y-4">
            <h4 className="text-sm font-bold text-white">Rename File or Folder</h4>
            <div>
              <label className="text-xs text-slate-400 block mb-1">New Name</label>
              <input
                type="text"
                value={renameNewName}
                onChange={(e) => setRenameNewName(e.target.value)}
                required
                className="w-full bg-[#151c2c] border border-slate-700 text-xs text-white p-2.5 rounded focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenameModalItem(null)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionBusy || !renameNewName.trim()}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded"
              >
                Rename
              </button>
            </div>
          </form>
        </div>
      )}

      {/* New Folder Modal */}
      {newFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <form onSubmit={handleCreateFolder} className="w-full max-w-sm bg-[#0e1320] border border-slate-800 rounded-xl p-5 space-y-4">
            <h4 className="text-sm font-bold text-white">Create New Folder</h4>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Folder Name</label>
              <input
                type="text"
                placeholder="e.g. plugins or schematics"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                required
                className="w-full bg-[#151c2c] border border-slate-700 text-xs text-white p-2.5 rounded focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNewFolderModal(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionBusy || !newFolderName.trim()}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {/* New File Modal */}
      {newFileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <form onSubmit={handleCreateFile} className="w-full max-w-sm bg-[#0e1320] border border-slate-800 rounded-xl p-5 space-y-4">
            <h4 className="text-sm font-bold text-white">Create New File</h4>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Filename</label>
              <input
                type="text"
                placeholder="e.g. config.yml, rules.txt, tokens.sk"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                required
                className="w-full bg-[#151c2c] border border-slate-700 text-xs text-white p-2.5 rounded focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNewFileModal(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionBusy || !newFileName.trim()}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded"
              >
                Create File
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
