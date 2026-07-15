import { useState, useEffect, useCallback } from 'react';
import { useFS, type DirStats } from './FileSystemContext';

interface NoteForm {
  title: string; background: string; concepts: string; framework: string; refs: string;
}

const emptyForm: NoteForm = { title: '', background: '', concepts: '', framework: '', refs: '' };

function slugify(s: string) {
  return s.trim().replace(/[\s.,/#!$%^&*;:{}=`~()？。，！、；：""''…—·《》【】\[\]]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || Date.now().toString();
}

function buildMd(f: NoteForm) {
  const block = (label: string, val: string) => {
    const v = val?.trim();
    return v ? `\n## ${label}\n\n${v}\n` : '';
  };
  return `# ${f.title}\n${block('背景', f.background)}${block('核心概念', f.concepts)}${block('知识框架', f.framework)}${block('参考文献', f.refs)}`;
}

function parseMd(content: string): NoteForm {
  const fm = { ...emptyForm };
  const titleM = content.match(/^# (.+)/);
  if (titleM) fm.title = titleM[1];
  for (const s of ['背景', '核心概念', '知识框架', '参考文献']) {
    const re = new RegExp(`## ${s}\\n\\n([\\s\\S]*?)(?=\\n## |$)`);
    const mm = content.match(re);
    if (mm) {
      const key = s === '核心概念' ? 'concepts' : s === '知识框架' ? 'framework' : s === '参考文献' ? 'refs' : 'background';
      (fm as any)[key] = mm[1].trim();
    }
  }
  return fm;
}

const s = {
  panel: { background: 'var(--rp-c-bg-soft, #f9fafb)', borderRadius: 8, padding: 20, marginBottom: 24, border: '1px solid var(--rp-c-divider, #e5e7eb)' } as React.CSSProperties,
  input: { width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 14, marginBottom: 8, boxSizing: 'border-box' as any },
  textarea: { width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 14, marginBottom: 8, minHeight: 80, resize: 'vertical' as any, boxSizing: 'border-box' as any, fontFamily: 'inherit' },
  btn: { padding: '6px 16px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500 } as React.CSSProperties,
  btnPrimary: { background: '#3b82f6', color: '#fff' } as React.CSSProperties,
  btnDanger: { background: 'transparent', color: '#ef4444', border: '1px solid #ef4444' } as React.CSSProperties,
  btnGhost: { background: 'transparent', color: '#6b7280', border: '1px solid #d1d5db' } as React.CSSProperties,
  label: { display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 2, color: 'var(--rp-c-text-2, #555)' } as React.CSSProperties,
  listItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--rp-c-divider, #eee)' } as React.CSSProperties,
  statBadge: { display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 500, marginRight: 12, background: '#e0e7ff', color: '#4338ca' } as React.CSSProperties,
};

export function NotesManager() {
  const { rootHandle, selectRoot, readFile, writeFile, deleteFile, listFiles, addMetaEntry, removeMetaEntry, computeStats, rebuildNotesIndex } = useFS();
  const [notes, setNotes] = useState<string[]>([]);
  const [form, setForm] = useState<NoteForm>(emptyForm);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [stats, setStats] = useState<DirStats>({ count: 0, lastModified: '—', totalChars: 0 });

  const refresh = useCallback(async () => {
    if (!rootHandle) return;
    const files = await listFiles('docs/notes', '.md');
    setNotes(files.filter(f => f !== 'index.md').map(f => f.replace('.md', '')));
    const st = await computeStats('docs/notes', '.md', ['index.md']);
    setStats(st);
  }, [rootHandle, listFiles, computeStats]);

  useEffect(() => { refresh(); }, [refresh]);

  const save = async () => {
    if (!form.title.trim()) return setMsg('笔记标题不能为空');
    const slug = editingSlug || slugify(form.title);
    try {
      await writeFile(`docs/notes/${slug}.md`, buildMd(form));
      if (!editingSlug) await addMetaEntry('docs/notes', { type: 'file', name: slug, label: form.title });
      await rebuildNotesIndex();
      setMsg(editingSlug ? '笔记已更新' : '笔记已创建');
      setForm(emptyForm);
      setEditingSlug(null);
      await refresh();
    } catch (e: any) { setMsg(e.message); }
  };

  const edit = async (slug: string) => {
    try {
      const content = await readFile(`docs/notes/${slug}.md`);
      setForm(parseMd(content));
      setEditingSlug(slug);
      setMsg('');
    } catch (e: any) { setMsg(e.message); }
  };

  const remove = async (slug: string) => {
    if (!confirm(`确定删除笔记"${slug}"吗？`)) return;
    try {
      await deleteFile(`docs/notes/${slug}.md`);
      await removeMetaEntry('docs/notes', slug);
      await rebuildNotesIndex();
      if (editingSlug === slug) { setForm(emptyForm); setEditingSlug(null); }
      await refresh();
      setMsg('笔记已删除');
    } catch (e: any) { setMsg(e.message); }
  };

  const cancel = () => { setForm(emptyForm); setEditingSlug(null); setMsg(''); };

  if (!rootHandle) {
    return (
      <div style={s.panel}>
        <p style={{ marginBottom: 12 }}>需要授权访问项目目录才能管理笔记。</p>
        <button style={{ ...s.btn, ...s.btnPrimary }} onClick={selectRoot}>选择项目目录</button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 16, padding: '10px 0' }}>
        <span style={s.statBadge}>共 {stats.count} 篇</span>
        <span style={s.statBadge}>总字数 {stats.totalChars.toLocaleString()}</span>
        <span style={{ fontSize: 12, color: '#999' }}>最后更新：{stats.lastModified}</span>
      </div>

      <h3>{editingSlug ? '编辑笔记' : '添加笔记'}</h3>
      {msg && <p style={{ color: msg.includes('失败') || msg.includes('不能') ? '#ef4444' : '#22c55e', fontSize: 13, marginBottom: 8 }}>{msg}</p>}

      <div style={s.panel}>
        <label style={s.label}>笔记标题 *</label>
        <input style={s.input} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="笔记标题" />

        <label style={s.label}>背景</label>
        <textarea style={s.textarea} value={form.background} onChange={e => setForm({ ...form, background: e.target.value })} placeholder="为什么关注这个主题" />

        <label style={s.label}>核心概念</label>
        <textarea style={s.textarea} value={form.concepts} onChange={e => setForm({ ...form, concepts: e.target.value })} placeholder="列出关键概念和定义" />

        <label style={s.label}>知识框架</label>
        <textarea style={s.textarea} value={form.framework} onChange={e => setForm({ ...form, framework: e.target.value })} placeholder="构建该主题的知识体系图" />

        <label style={s.label}>参考文献</label>
        <textarea style={{ ...s.textarea, minHeight: 60 }} value={form.refs} onChange={e => setForm({ ...form, refs: e.target.value })} placeholder="关联的书籍和论文链接" />

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button style={{ ...s.btn, ...s.btnPrimary }} onClick={save}>{editingSlug ? '更新' : '创建笔记'}</button>
          {editingSlug && <button style={{ ...s.btn, ...s.btnGhost }} onClick={cancel}>取消编辑</button>}
        </div>
      </div>

      <h3>已有笔记</h3>
      <div style={s.panel}>
        {notes.length === 0 && <p style={{ color: '#999' }}>暂无笔记，请添加第一篇笔记。</p>}
        {notes.map(n => (
          <div key={n} style={s.listItem}>
            <span style={{ fontWeight: 500 }}>{n}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button style={{ ...s.btn, ...s.btnGhost }} onClick={() => edit(n)}>编辑</button>
              <button style={{ ...s.btn, ...s.btnDanger }} onClick={() => remove(n)}>删除</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
