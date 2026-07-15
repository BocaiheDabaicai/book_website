import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

const DB_NAME = 'book-website-fs';
const DB_VERSION = 1;
const STORE_NAME = 'handles';
const HANDLE_KEY = 'root-dir';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE_NAME); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveHandle(handle: FileSystemDirectoryHandle) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY);
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openDB();
    const handle = await new Promise<any>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(HANDLE_KEY);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (!handle) return null;
    const opts: FileSystemHandlePermissionDescriptor = { mode: 'readwrite' };
    const perm = await handle.queryPermission(opts);
    if (perm === 'granted') return handle;
    const reqPerm = await handle.requestPermission(opts);
    return reqPerm === 'granted' ? handle : null;
  } catch {
    return null;
  }
}

async function clearHandle() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(HANDLE_KEY);
  } catch { /* ignore */ }
}

interface MetaEntry {
  type: string;
  name: string;
  label: string;
}

export interface DirStats {
  count: number;
  lastModified: string;
  totalChars: number;
}

interface FSContextType {
  rootHandle: FileSystemDirectoryHandle | null;
  selectRoot: () => Promise<FileSystemDirectoryHandle | null>;
  forgetRoot: () => Promise<void>;
  readFile: (relativePath: string) => Promise<string>;
  writeFile: (relativePath: string, content: string) => Promise<void>;
  writeBinaryFile: (relativePath: string, data: ArrayBuffer | Blob) => Promise<void>;
  deleteFile: (relativePath: string) => Promise<void>;
  listFiles: (relativeDir: string, ext?: string) => Promise<string[]>;
  fileExists: (relativePath: string) => Promise<boolean>;
  readMetaJson: (dir: string) => Promise<MetaEntry[]>;
  addMetaEntry: (dir: string, entry: MetaEntry) => Promise<void>;
  removeMetaEntry: (dir: string, name: string) => Promise<void>;
  computeStats: (dir: string, ext: string, exclude: string[]) => Promise<DirStats>;
  rebuildBooksIndex: () => Promise<void>;
  rebuildPapersIndex: () => Promise<void>;
  rebuildNotesIndex: () => Promise<void>;
  updateSummaryTable: (entries: { title: string; author: string; year: string; journal: string }[]) => Promise<void>;
}

const Ctx = createContext<FSContextType>(null!);
export const useFS = () => useContext(Ctx);

async function resolveHandle(
  root: FileSystemDirectoryHandle,
  relativePath: string,
): Promise<{ dir: FileSystemDirectoryHandle; name: string }> {
  const parts = relativePath.replace(/\\/g, '/').split('/');
  const name = parts.pop()!;
  let dir = root;
  for (const part of parts) {
    if (!part) continue;
    dir = await dir.getDirectoryHandle(part, { create: true });
  }
  return { dir, name };
}

export function FileSystemProvider({ children }: { children: ReactNode }) {
  const [rootHandle, setRootHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHandle().then(handle => {
      if (handle) setRootHandle(handle);
      setLoading(false);
    });
  }, []);

  const selectRoot = useCallback(async () => {
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      setRootHandle(handle);
      await saveHandle(handle);
      return handle;
    } catch {
      return null;
    }
  }, []);

  const forgetRoot = useCallback(async () => {
    setRootHandle(null);
    await clearHandle();
  }, []);

  const getRoot = useCallback((): FileSystemDirectoryHandle => {
    if (!rootHandle) throw new Error('未选择项目目录');
    return rootHandle;
  }, [rootHandle]);

  const readFile = useCallback(async (relativePath: string) => {
    const root = getRoot();
    const { dir, name } = await resolveHandle(root, relativePath);
    const fileHandle = await dir.getFileHandle(name);
    const file = await fileHandle.getFile();
    return file.text();
  }, [getRoot]);

  const writeFile = useCallback(async (relativePath: string, content: string) => {
    const root = getRoot();
    const { dir, name } = await resolveHandle(root, relativePath);
    const fileHandle = await dir.getFileHandle(name, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  }, [getRoot]);

  const writeBinaryFile = useCallback(async (relativePath: string, data: ArrayBuffer | Blob) => {
    const root = getRoot();
    const { dir, name } = await resolveHandle(root, relativePath);
    const fileHandle = await dir.getFileHandle(name, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(data);
    await writable.close();
  }, [getRoot]);

  const deleteFile = useCallback(async (relativePath: string) => {
    const root = getRoot();
    const { dir, name } = await resolveHandle(root, relativePath);
    await dir.removeEntry(name);
  }, [getRoot]);

  const listFiles = useCallback(async (relativeDir: string, ext?: string) => {
    const root = getRoot();
    const { dir } = await resolveHandle(root, relativeDir + '/_dummy');
    const names: string[] = [];
    for await (const [name, handle] of (dir as any).entries()) {
      if (handle.kind === 'file') {
        if (!ext || name.endsWith(ext)) names.push(name);
      }
    }
    return names.sort();
  }, [getRoot]);

  const fileExists = useCallback(async (relativePath: string) => {
    try {
      const root = getRoot();
      const { dir, name } = await resolveHandle(root, relativePath);
      await dir.getFileHandle(name);
      return true;
    } catch {
      return false;
    }
  }, [getRoot]);

  // --- _meta.json helpers ---

  const readMetaJson = useCallback(async (dir: string): Promise<MetaEntry[]> => {
    try {
      const content = await readFile(`${dir}/_meta.json`);
      return JSON.parse(content);
    } catch {
      return [];
    }
  }, [readFile]);

  const addMetaEntry = useCallback(async (dir: string, entry: MetaEntry) => {
    const meta = await readMetaJson(dir);
    if (meta.some(m => typeof m !== 'string' && m.name === entry.name)) return;
    // Insert divider before first content item if not already present
    if (!meta.some(m => typeof m === 'object' && m.type === 'divider')) {
      meta.push({ type: 'divider' });
    }
    meta.push(entry);
    await writeFile(`${dir}/_meta.json`, JSON.stringify(meta, null, 2) + '\n');
  }, [readMetaJson, writeFile]);

  const removeMetaEntry = useCallback(async (dir: string, name: string) => {
    const meta = await readMetaJson(dir);
    const filtered = meta.filter(m => (typeof m === 'object' && m.type === 'divider') || m.name !== name);
    // Remove divider if no content items left
    const noContent = filtered.every(m => (typeof m === 'object' && m.type === 'divider') || ['index', 'summary', 'example'].includes(m.name));
    const result = noContent ? filtered.filter(m => !(typeof m === 'object' && m.type === 'divider')) : filtered;
    if (JSON.stringify(result) !== JSON.stringify(meta)) {
      await writeFile(`${dir}/_meta.json`, JSON.stringify(result, null, 2) + '\n');
    }
  }, [readMetaJson, writeFile]);

  // --- Stats ---

  const computeStats = useCallback(async (dir: string, ext: string, exclude: string[]): Promise<DirStats> => {
    const root = getRoot();
    let count = 0;
    let totalChars = 0;
    let lastModified = 0;
    try {
      const { dir: dirHandle } = await resolveHandle(root, dir + '/_dummy');
      for await (const [name, handle] of (dirHandle as any).entries()) {
        if (handle.kind === 'file' && name.endsWith(ext) && !exclude.includes(name)) {
          count++;
          const fh = handle as FileSystemFileHandle;
          const file = await fh.getFile();
          const text = await file.text();
          totalChars += text.length;
          if (file.lastModified > lastModified) lastModified = file.lastModified;
        }
      }
    } catch { /* dir not found */ }
    return {
      count,
      totalChars,
      lastModified: lastModified ? new Date(lastModified).toLocaleString('zh-CN') : '—',
    };
  }, [getRoot]);

  // --- Rebuild index.md pages ---

  const rebuildBooksIndex = useCallback(async () => {
    const files = await listFiles('docs/books', '.md');
    const books = files.filter(f => f !== 'index.md');
    const stats = await computeStats('docs/books', '.md', ['index.md']);

    let rows = '';
    for (const f of books) {
      const slug = f.replace('.md', '');
      let author = '—', status = '—';
      try {
        const content = await readFile(`docs/books/${f}`);
        const am = content.match(/- \*\*作者\*\*：(.+)/);
        if (am && am[1].trim() !== '—') author = am[1].trim();
        const sm = content.match(/- \*\*阅读状态\*\*：(.+)/);
        if (sm) status = sm[1].trim();
      } catch { /* ignore */ }
      rows += `| [${slug}](/books/${slug}) | ${author} | ${status} |\n`;
    }

    const md = `# 书籍

> 共 **${stats.count}** 本书籍 · 最后更新：${stats.lastModified} · 总字数：${stats.totalChars.toLocaleString()}

## 书籍列表

| 书名 | 作者 | 状态 |
|------|------|------|
${rows || '| — | — | — |\n'}
`;
    await writeFile('docs/books/index.md', md);
  }, [listFiles, computeStats, readFile, writeFile]);

  const rebuildPapersIndex = useCallback(async () => {
    const allFiles = await listFiles('docs/papers');
    const papers = allFiles.filter(f => (f.endsWith('.md') || f.endsWith('.mdx')) && !['index.md', 'summary.md'].includes(f) && !f.startsWith('summaries/'));
    const pdfFiles = await listFiles('docs/public/papers', '.pdf');
    const stats = await computeStats('docs/papers', '.md', ['index.md', 'summary.md']);

    let rows = '';
    for (const f of papers) {
      const slug = f.replace(/\.(md|mdx)$/, '');
      let author = '—', year = '—';
      try {
        const content = await readFile(`docs/papers/${f}`);
        const am = content.match(/- \*\*作者\*\*：(.+)/);
        if (am && am[1].trim() !== '—') author = am[1].trim();
        const ym = content.match(/- \*\*年份\*\*：(.+)/);
        if (ym && ym[1].trim() !== '—') year = ym[1].trim();
      } catch { /* ignore */ }
      rows += `| [${slug}](/papers/${slug}) | ${author} | ${year} |\n`;
    }

    const md = `# 论文

> 共 **${stats.count}** 篇论文 · PDF 文件：**${pdfFiles.length}** 个 · 最后更新：${stats.lastModified} · 总字数：${stats.totalChars.toLocaleString()}

## 论文列表

| 标题 | 作者 | 年份 |
|------|------|------|
${rows || '| — | — | — |\n'}
`;
    await writeFile('docs/papers/index.md', md);
  }, [listFiles, computeStats, readFile, writeFile]);

  const rebuildNotesIndex = useCallback(async () => {
    const files = await listFiles('docs/notes', '.md');
    const notes = files.filter(f => f !== 'index.md');
    const stats = await computeStats('docs/notes', '.md', ['index.md']);

    let rows = '';
    for (const f of notes) {
      const slug = f.replace('.md', '');
      rows += `| [${slug}](/notes/${slug}) |\n`;
    }

    const md = `# 笔记总结

> 共 **${stats.count}** 篇笔记 · 最后更新：${stats.lastModified} · 总字数：${stats.totalChars.toLocaleString()}

## 笔记列表

| 笔记标题 |
|---------|
${rows || '| — |\n'}
`;
    await writeFile('docs/notes/index.md', md);
  }, [listFiles, computeStats, writeFile]);

  // --- Update summary table ---

  const updateSummaryTable = useCallback(async (entries: { title: string; author: string; year: string; journal: string }[]) => {
    const now = new Date().toLocaleString('zh-CN');

    let tableRows = '';
    entries.forEach((e, i) => {
      tableRows += `| ${i + 1} | ${e.title} | ${e.author || '—'} | ${e.year || '—'} | ${e.journal || '—'} | — | — | — | — |\n`;
    });

    let existing = '';
    try { existing = await readFile('docs/papers/summary.md'); } catch { /* file not found */ }

    // Replace or insert the table section
    const tableStartMarker = '| 序号 | 文献标题 |';
    const tableEndMarker = '\n---\n\n## 精读记录模板';
    const tableStart = existing.indexOf(tableStartMarker);
    const tableEnd = existing.indexOf(tableEndMarker);

    let before = '', after = '';
    if (tableStart >= 0 && tableEnd >= 0) {
      before = existing.slice(0, tableStart);
      after = existing.slice(tableEnd + 1); // skip the leading \n
    } else {
      before = '# 论文总结\n\n统一的论文精读总结记录。\n\n---\n\n## 论文列表\n\n> 按阅读时间倒序排列。点击论文标题跳转到详细页面（含 PDF 在线阅读）。\n\n';
      after = '\n\n## 精读记录模板\n\n每篇论文精读请按以下格式记录在下方：\n\n```markdown\n...\n```\n';
    }

    const newContent = `${before}| 序号 | 文献标题 | 作者 | 年份 | 期刊 | 研究场景 | 核心问题 | 研究方法 | 状态 |
|------|---------|------|------|------|---------|---------|---------|------|
${tableRows || '| — | — | — | — | — | — | — | — | — |\n'}${after}`;

    await writeFile('docs/papers/summary.md', newContent);
  }, [readFile, writeFile]);

  const value: FSContextType = {
    rootHandle, selectRoot, forgetRoot,
    readFile, writeFile, writeBinaryFile, deleteFile, listFiles, fileExists,
    readMetaJson, addMetaEntry, removeMetaEntry,
    computeStats,
    rebuildBooksIndex, rebuildPapersIndex, rebuildNotesIndex,
    updateSummaryTable,
  };

  if (loading) {
    return <div style={{ padding: 40, color: '#999', textAlign: 'center' }}>正在恢复文件系统权限...</div>;
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
