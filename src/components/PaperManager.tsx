import { useState, useEffect, useCallback } from 'react';
import { useFS, type DirStats } from './FileSystemContext';

interface PaperForm {
  title: string; author: string; year: string; journal: string; pdfFile: string;
}

const emptyForm: PaperForm = { title: '', author: '', year: '', journal: '', pdfFile: '' };

function slugify(s: string) {
  return s.trim().replace(/[\s.,/#!$%^&*;:{}=`~()？。，！、；：""''…—·《》【】\[\]]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || Date.now().toString();
}

function buildMdx(f: PaperForm) {
  const pdfLink = f.pdfFile ? `\n<PDFLink href="/papers/${f.pdfFile}" />\n` : '';
  const safeTitle = f.title.replace(/"/g, '\\"');
  return `---
title: "${safeTitle}"
---

import { PDFLink } from '../../src/components/PDFLink';

# ${f.title}
${pdfLink}
## 论文信息

- **作者**：${f.author || '—'}
- **年份**：${f.year || '—'}
- **期刊**：${f.journal || '—'}

## 阅读笔记

> 在此记录阅读过程中的思考和批注。
`;
}

const s = {
  panel: { background: 'var(--rp-c-bg-soft, #f9fafb)', borderRadius: 8, padding: 20, marginBottom: 24, border: '1px solid var(--rp-c-divider, #e5e7eb)' } as React.CSSProperties,
  input: { width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 14, marginBottom: 8, boxSizing: 'border-box' as any },
  btn: { padding: '6px 16px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500 } as React.CSSProperties,
  btnPrimary: { background: '#3b82f6', color: '#fff' } as React.CSSProperties,
  btnDanger: { background: 'transparent', color: '#ef4444', border: '1px solid #ef4444' } as React.CSSProperties,
  btnGhost: { background: 'transparent', color: '#6b7280', border: '1px solid #d1d5db' } as React.CSSProperties,
  label: { display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 2, color: 'var(--rp-c-text-2, #555)' } as React.CSSProperties,
  listItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--rp-c-divider, #eee)' } as React.CSSProperties,
  dropZone: { border: '2px dashed #d1d5db', borderRadius: 8, padding: '30px', textAlign: 'center' as any, cursor: 'pointer', marginBottom: 12, background: '#fff', transition: 'border-color .2s' } as React.CSSProperties,
  dropZoneActive: { borderColor: '#3b82f6', background: '#eff6ff' } as React.CSSProperties,
  statBadge: { display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 500, marginRight: 12, background: '#e0e7ff', color: '#4338ca' } as React.CSSProperties,
};

export function PaperManager() {
  const { rootHandle, selectRoot, writeFile, writeBinaryFile, deleteFile, listFiles, addMetaEntry, removeMetaEntry, computeStats, rebuildPapersIndex } = useFS();
  const [papers, setPapers] = useState<string[]>([]);
  const [pdfs, setPdfs] = useState<string[]>([]);
  const [form, setForm] = useState<PaperForm>(emptyForm);
  const [msg, setMsg] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [stats, setStats] = useState<DirStats>({ count: 0, lastModified: '—', totalChars: 0 });
  const [pdfCount, setPdfCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!rootHandle) return;
    const allFiles = await listFiles('docs/papers');
    const mdFiles = allFiles.filter(f => (f.endsWith('.md') || f.endsWith('.mdx')) && !['index.md', 'summary.md'].includes(f));
    setPapers(mdFiles.map(f => f.replace(/\.(md|mdx)$/, '')));
    const pdfFiles = await listFiles('docs/public/papers', '.pdf');
    setPdfs(pdfFiles);
    setPdfCount(pdfFiles.length);
    const st = await computeStats('docs/papers', '.md', ['index.md', 'summary.md']);
    setStats(st);
  }, [rootHandle, listFiles, computeStats]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const items = e.dataTransfer.items;
    if (items.length === 0) return;
    setUploading(true);
    try {
      for (const item of items) {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file && file.name.endsWith('.pdf')) {
            const handle = await (item as any).getAsFileSystemHandle?.();
            if (handle && handle.kind === 'file') {
              const fileHandle = handle as FileSystemFileHandle;
              const srcFile = await fileHandle.getFile();
              await writeBinaryFile(`docs/public/papers/${file.name}`, srcFile);
            } else {
              const buf = await file.arrayBuffer();
              await writeBinaryFile(`docs/public/papers/${file.name}`, buf);
            }
            setForm(prev => ({ ...prev, pdfFile: file.name }));
            setMsg(`PDF "${file.name}" 已上传`);
          }
        }
      }
      await refresh();
    } catch (e: any) { setMsg(`上传失败: ${e.message}`); }
    setUploading(false);
  }, [writeBinaryFile, refresh]);

  const save = async () => {
    if (!form.title.trim()) return setMsg('论文标题不能为空');
    const slug = slugify(form.title);
    try {
      await writeFile(`docs/papers/${slug}.mdx`, buildMdx(form));
      await addMetaEntry('docs/papers', { type: 'file', name: slug, label: form.title });
      await rebuildPapersIndex();
      setMsg('论文页面已创建');
      setForm(emptyForm);
      await refresh();
    } catch (e: any) { setMsg(e.message); }
  };

  const remove = async (slug: string) => {
    if (!confirm(`确定删除论文"${slug}"及其关联页面吗？`)) return;
    try {
      // Try both .mdx and .md
      try { await deleteFile(`docs/papers/${slug}.mdx`); } catch { await deleteFile(`docs/papers/${slug}.md`); }
      await removeMetaEntry('docs/papers', slug);
      await rebuildPapersIndex();
      await refresh();
      setMsg('论文已删除');
    } catch (e: any) { setMsg(e.message); }
  };

  const removePdf = async (filename: string) => {
    if (!confirm(`确定删除 PDF "${filename}"吗？`)) return;
    try {
      await deleteFile(`docs/public/papers/${filename}`);
      if (form.pdfFile === filename) setForm({ ...form, pdfFile: '' });
      await refresh();
      setMsg('PDF 已删除');
    } catch (e: any) { setMsg(e.message); }
  };

  if (!rootHandle) {
    return (
      <div style={s.panel}>
        <p style={{ marginBottom: 12 }}>需要授权访问项目目录才能管理论文。</p>
        <button style={{ ...s.btn, ...s.btnPrimary }} onClick={selectRoot}>选择项目目录</button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 16, padding: '10px 0' }}>
        <span style={s.statBadge}>论文 {stats.count} 篇</span>
        <span style={s.statBadge}>PDF {pdfCount} 个</span>
        <span style={s.statBadge}>总字数 {stats.totalChars.toLocaleString()}</span>
        <span style={{ fontSize: 12, color: '#999' }}>最后更新：{stats.lastModified}</span>
      </div>

      <h3>添加论文</h3>
      {msg && <p style={{ color: msg.includes('失败') || msg.includes('不能') ? '#ef4444' : '#22c55e', fontSize: 13, marginBottom: 8 }}>{msg}</p>}

      <div style={s.panel}>
        <h4 style={{ marginTop: 0 }}>1. 上传 PDF（拖拽到下方区域）</h4>
        <div
          style={{ ...s.dropZone, ...(dragOver ? s.dropZoneActive : {}) }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          {uploading ? <p>上传中...</p> : <p>拖拽 PDF 文件到此处<br /><span style={{ color: '#999', fontSize: 12 }}>或点击下方按钮手动选择</span></p>}
          <input
            type="file" accept=".pdf" style={{ marginTop: 8 }}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setUploading(true);
              try {
                await writeBinaryFile(`docs/public/papers/${file.name}`, await file.arrayBuffer());
                setForm(prev => ({ ...prev, pdfFile: file.name }));
                setMsg(`PDF "${file.name}" 已上传`);
                await refresh();
              } catch (err: any) { setMsg(err.message); }
              setUploading(false);
            }}
          />
        </div>
        {form.pdfFile && <p style={{ fontSize: 13, color: '#22c55e' }}>已选择 PDF: {form.pdfFile}</p>}

        <h4>2. 填写论文信息</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <div>
            <label style={s.label}>论文标题 *</label>
            <input style={s.input} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="论文标题" />
          </div>
          <div>
            <label style={s.label}>PDF 文件</label>
            <select style={s.input} value={form.pdfFile} onChange={e => setForm({ ...form, pdfFile: e.target.value })}>
              <option value="">— 不关联 PDF —</option>
              {pdfs.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label style={s.label}>作者</label>
            <input style={s.input} value={form.author} onChange={e => setForm({ ...form, author: e.target.value })} placeholder="作者" />
          </div>
          <div>
            <label style={s.label}>年份</label>
            <input style={s.input} value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} placeholder="2024" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={s.label}>期刊</label>
            <input style={s.input} value={form.journal} onChange={e => setForm({ ...form, journal: e.target.value })} placeholder="期刊名称" />
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <button style={{ ...s.btn, ...s.btnPrimary }} onClick={save}>创建论文页面</button>
        </div>
      </div>

      <h3>已上传 PDF</h3>
      <div style={s.panel}>
        {pdfs.length === 0 && <p style={{ color: '#999' }}>暂无 PDF 文件。</p>}
        {pdfs.map(p => (
          <div key={p} style={s.listItem}>
            <span style={{ fontWeight: 500 }}>{p}</span>
            <button style={{ ...s.btn, ...s.btnDanger }} onClick={() => removePdf(p)}>删除</button>
          </div>
        ))}
      </div>

      <h3>论文页面</h3>
      <div style={s.panel}>
        {papers.length === 0 && <p style={{ color: '#999' }}>暂无论文页面。</p>}
        {papers.map(p => (
          <div key={p} style={s.listItem}>
            <span style={{ fontWeight: 500 }}>{p}</span>
            <button style={{ ...s.btn, ...s.btnDanger }} onClick={() => remove(p)}>删除</button>
          </div>
        ))}
      </div>
    </div>
  );
}
