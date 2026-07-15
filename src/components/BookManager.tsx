import { useState, useEffect, useCallback } from 'react';
import { useFS, type DirStats } from './FileSystemContext';

interface BookForm {
  title: string; author: string; publisher: string; year: string;
  isbn: string; status: string; date: string;
  overview: string; points: string; thoughts: string; actions: string;
}

const emptyForm: BookForm = {
  title: '', author: '', publisher: '', year: '',
  isbn: '', status: '阅读中', date: new Date().toISOString().slice(0, 10),
  overview: '', points: '', thoughts: '', actions: '',
};

function slugify(s: string) {
  return s.trim().replace(/[\s.,/#!$%^&*;:{}=`~()？。，！、；：""''…—·《》【】\[\]]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || Date.now().toString();
}

function buildMd(f: BookForm) {
  const n = (v: string) => v?.trim() || '';
  const block = (label: string, val: string) => n(val) ? `\n## ${label}\n\n${val.trim()}\n` : '';
  return `# 《${f.title}》

- **作者**：${n(f.author) || '—'}
- **出版社**：${n(f.publisher) || '—'}
- **出版年份**：${n(f.year) || '—'}
- **ISBN**：${n(f.isbn) || '—'}
- **阅读状态**：${f.status || '阅读中'}
- **阅读日期**：${f.date || '—'} ~
${block('概述', f.overview)}${block('核心观点', f.points)}${block('我的思考', f.thoughts)}${block('行动清单', f.actions)}`;
}

function parseMd(content: string): BookForm {
  const fm = { ...emptyForm };
  const titleM = content.match(/^# 《(.+?)》/);
  if (titleM) fm.title = titleM[1];
  const meta = ['作者', '出版社', '出版年份', 'ISBN', '阅读状态', '阅读日期'];
  for (const m of meta) {
    const re = new RegExp(`- \\*\\*${m}\\*\\*：(.+)`);
    const mm = content.match(re);
    if (mm) {
      const v = mm[1].trim();
      if (v !== '—') {
        if (m === '作者') fm.author = v;
        else if (m === '出版社') fm.publisher = v;
        else if (m === '出版年份') fm.year = v;
        else if (m === 'ISBN') fm.isbn = v;
        else if (m === '阅读状态') fm.status = v;
        else if (m === '阅读日期' && v !== '—') fm.date = v.split(' ~')[0];
      }
    }
  }
  for (const s of ['概述', '核心观点', '我的思考', '行动清单']) {
    const re = new RegExp(`## ${s}\\n\\n([\\s\\S]*?)(?=\\n## |$)`);
    const mm = content.match(re);
    if (mm) (fm as any)[s === '核心观点' ? 'points' : s === '我的思考' ? 'thoughts' : s === '行动清单' ? 'actions' : 'overview'] = mm[1].trim();
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

export function BookManager() {
  const { rootHandle, selectRoot, readFile, writeFile, deleteFile, listFiles, addMetaEntry, removeMetaEntry, computeStats, rebuildBooksIndex } = useFS();
  const [books, setBooks] = useState<string[]>([]);
  const [form, setForm] = useState<BookForm>(emptyForm);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [stats, setStats] = useState<DirStats>({ count: 0, lastModified: '—', totalChars: 0 });

  const refresh = useCallback(async () => {
    if (!rootHandle) return;
    const files = await listFiles('docs/books', '.md');
    setBooks(files.filter(f => f !== 'index.md').map(f => f.replace('.md', '')));
    const st = await computeStats('docs/books', '.md', ['index.md']);
    setStats(st);
  }, [rootHandle, listFiles, computeStats]);

  useEffect(() => { refresh(); }, [refresh]);

  const save = async () => {
    if (!form.title.trim()) return setMsg('书名不能为空');
    const slug = editingSlug || slugify(form.title);
    try {
      await writeFile(`docs/books/${slug}.md`, buildMd(form));
      if (!editingSlug) await addMetaEntry('docs/books', { type: 'file', name: slug, label: form.title });
      await rebuildBooksIndex();
      setMsg(editingSlug ? '书籍已更新' : '书籍已创建');
      setForm(emptyForm);
      setEditingSlug(null);
      await refresh();
    } catch (e: any) { setMsg(e.message); }
  };

  const edit = async (slug: string) => {
    try {
      const content = await readFile(`docs/books/${slug}.md`);
      setForm(parseMd(content));
      setEditingSlug(slug);
      setMsg('');
    } catch (e: any) { setMsg(e.message); }
  };

  const remove = async (slug: string) => {
    if (!confirm(`确定删除书籍"${slug}"吗？`)) return;
    try {
      await deleteFile(`docs/books/${slug}.md`);
      await removeMetaEntry('docs/books', slug);
      await rebuildBooksIndex();
      if (editingSlug === slug) { setForm(emptyForm); setEditingSlug(null); }
      await refresh();
      setMsg('书籍已删除');
    } catch (e: any) { setMsg(e.message); }
  };

  const cancel = () => { setForm(emptyForm); setEditingSlug(null); setMsg(''); };

  if (!rootHandle) {
    return (
      <div style={s.panel}>
        <p style={{ marginBottom: 12 }}>需要授权访问项目目录。如果之前已授权但权限被撤销，请重新选择。</p>
        <button style={{ ...s.btn, ...s.btnPrimary }} onClick={selectRoot}>选择项目目录</button>
      </div>
    );
  }

  return (
    <div>
      {/* Stats bar */}
      <div style={{ marginBottom: 16, padding: '10px 0' }}>
        <span style={s.statBadge}>共 {stats.count} 本</span>
        <span style={s.statBadge}>总字数 {stats.totalChars.toLocaleString()}</span>
        <span style={{ fontSize: 12, color: '#999' }}>最后更新：{stats.lastModified}</span>
      </div>

      <h3>{editingSlug ? '编辑书籍' : '添加书籍'}</h3>
      {msg && <p style={{ color: msg.includes('失败') || msg.includes('不能') ? '#ef4444' : '#22c55e', fontSize: 13, marginBottom: 8 }}>{msg}</p>}

      <div style={s.panel}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <div>
            <label style={s.label}>书名 *</label>
            <input style={s.input} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="输入书名" />
          </div>
          <div>
            <label style={s.label}>作者</label>
            <input style={s.input} value={form.author} onChange={e => setForm({ ...form, author: e.target.value })} placeholder="作者" />
          </div>
          <div>
            <label style={s.label}>出版社</label>
            <input style={s.input} value={form.publisher} onChange={e => setForm({ ...form, publisher: e.target.value })} placeholder="出版社" />
          </div>
          <div>
            <label style={s.label}>出版年份</label>
            <input style={s.input} value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} placeholder="2024" />
          </div>
          <div>
            <label style={s.label}>ISBN</label>
            <input style={s.input} value={form.isbn} onChange={e => setForm({ ...form, isbn: e.target.value })} placeholder="ISBN" />
          </div>
          <div>
            <label style={s.label}>阅读状态</label>
            <select style={s.input} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              <option>阅读中</option><option>已读完</option><option>待阅读</option>
            </select>
          </div>
        </div>
        <label style={s.label}>概述</label>
        <textarea style={s.textarea} value={form.overview} onChange={e => setForm({ ...form, overview: e.target.value })} placeholder="简要描述本书的主题和核心内容" />
        <label style={s.label}>核心观点</label>
        <textarea style={s.textarea} value={form.points} onChange={e => setForm({ ...form, points: e.target.value })} placeholder="记录书中重要的观点和理论框架" />
        <label style={s.label}>我的思考</label>
        <textarea style={s.textarea} value={form.thoughts} onChange={e => setForm({ ...form, thoughts: e.target.value })} placeholder="个人的阅读心得、批判性思考和启发" />
        <label style={s.label}>行动清单</label>
        <textarea style={s.textarea} value={form.actions} onChange={e => setForm({ ...form, actions: e.target.value })} placeholder="从书中获得的 actionable 建议" />

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button style={{ ...s.btn, ...s.btnPrimary }} onClick={save}>{editingSlug ? '更新' : '创建书籍'}</button>
          {editingSlug && <button style={{ ...s.btn, ...s.btnGhost }} onClick={cancel}>取消编辑</button>}
        </div>
      </div>

      <h3>已有书籍</h3>
      <div style={s.panel}>
        {books.length === 0 && <p style={{ color: '#999' }}>暂无书籍，请添加第一本书。</p>}
        {books.map(b => (
          <div key={b} style={s.listItem}>
            <span style={{ fontWeight: 500 }}>{b}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button style={{ ...s.btn, ...s.btnGhost }} onClick={() => edit(b)}>编辑</button>
              <button style={{ ...s.btn, ...s.btnDanger }} onClick={() => remove(b)}>删除</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
