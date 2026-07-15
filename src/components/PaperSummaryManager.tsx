import { useState, useEffect, useCallback } from 'react';
import { useFS } from './FileSystemContext';

interface SummaryForm {
  title: string; author: string; year: string; journal: string;
  scenario: string; coreProblem: string; method: string;
  variables: string; conclusion: string; limitations: string; reference: string;
}

const emptyForm: SummaryForm = {
  title: '', author: '', year: '', journal: '',
  scenario: '', coreProblem: '', method: '',
  variables: '', conclusion: '', limitations: '', reference: '',
};

function slugify(s: string) {
  return s.trim().replace(/[\s.,/#!$%^&*;:{}=`~()？。，！、；：""''…—·《》【】\[\]]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || Date.now().toString();
}

function buildSummaryMd(f: SummaryForm) {
  const date = new Date().toISOString().slice(0, 10);
  const n = (v: string) => v?.trim() || '';

  const safeTitle = f.title.replace(/"/g, '\\"');
  return `---
title: "${safeTitle}"
---

# ${f.title}

> 阅读日期：${date} | 作者：${n(f.author) || '—'} | 年份：${n(f.year) || '—'} | 期刊：${n(f.journal) || '—'}

## 研究场景

${n(f.scenario) || '（基建 / 制造 / EPC / 智能建造）'}

## 核心问题

${n(f.coreProblem) || '（现有工程管理存在什么痛点）'}

## 研究方法

${n(f.method) || '（定性 / 定量；模型 / 算法 / 案例分析 / 问卷）'}

## 核心变量 / 评价指标

${n(f.variables) || '（重点摘抄）'}

## 研究结论与实践价值

${n(f.conclusion) || '（企业 / 项目层面应用）'}

## 研究局限

${n(f.limitations) || '（该论文创新突破口）'}

## 可借鉴内容

${n(f.reference) || '（框架、问卷设计、优化思路、仿真流程）'}
`;
}

// Extract entry list from summary.md table rows
function extractFromTable(content: string): { title: string; author: string; year: string; journal: string; slug: string }[] {
  const entries: { title: string; author: string; year: string; journal: string; slug: string }[] = [];
  // Find table: either "| 文献标题 |" or old "| 序号 | 文献标题 |"
  const tableStart = content.indexOf('| 文献标题 |');
  if (tableStart < 0) return entries;
  // Find end of table: next blank line followed by non-table content, or end of file
  const afterTable = content.slice(tableStart);
  const lines = afterTable.split('\n');
  for (const line of lines) {
    if (line.startsWith('|---') || line.startsWith('| 文献标题 |') || line.startsWith('| 序号 |') || !line.trim() || !line.includes('|')) continue;
    const cols = line.split('|').map(c => c.trim()).filter(Boolean);
    if (cols.length >= 1) {
      // First col may have link: [title](/papers/summaries/slug)
      const linkMatch = cols[0].match(/\[(.+?)\]\(\/papers\/summaries\/(.+?)\)/);
      if (linkMatch) {
        entries.push({
          title: linkMatch[1],
          author: cols[1] || '—',
          year: cols[2] || '—',
          journal: cols[3] || '—',
          slug: linkMatch[2],
        });
      }
    }
  }
  return entries;
}

const s = {
  panel: { background: 'var(--rp-c-bg-soft, #f9fafb)', borderRadius: 8, padding: 20, marginBottom: 24, border: '1px solid var(--rp-c-divider, #e5e7eb)' } as React.CSSProperties,
  input: { width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 14, marginBottom: 8, boxSizing: 'border-box' as any },
  textarea: { width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 14, marginBottom: 8, minHeight: 80, resize: 'vertical' as any, boxSizing: 'border-box' as any, fontFamily: 'inherit' },
  btn: { padding: '6px 16px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500 } as React.CSSProperties,
  btnPrimary: { background: '#3b82f6', color: '#fff' } as React.CSSProperties,
  btnDanger: { background: 'transparent', color: '#ef4444', border: '1px solid #ef4444' } as React.CSSProperties,
  label: { display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 2, color: 'var(--rp-c-text-2, #555)' } as React.CSSProperties,
  statBadge: { display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 500, marginRight: 12, background: '#e0e7ff', color: '#4338ca' } as React.CSSProperties,
};

export function PaperSummaryManager() {
  const { rootHandle, selectRoot, readFile, writeFile, deleteFile, fileExists } = useFS();
  const [form, setForm] = useState<SummaryForm>(emptyForm);
  const [entries, setEntries] = useState<{ title: string; author: string; year: string; journal: string; slug: string }[]>([]);
  const [msg, setMsg] = useState('');

  const loadEntries = useCallback(async () => {
    if (!rootHandle) return;
    try {
      const content = await readFile('docs/papers/summary.md');
      setEntries(extractFromTable(content));
    } catch {
      setEntries([]);
    }
  }, [rootHandle, readFile]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const save = async () => {
    if (!form.title.trim()) return setMsg('论文标题不能为空');
    const slug = slugify(form.title);
    try {
      // Create individual summary .md file (no sidebar, not in _meta.json)
      await writeFile(`docs/papers/summaries/${slug}.md`, buildSummaryMd(form));

      // Update summary.md table with link to the new file
      await upsertTableRow({
        title: form.title,
        author: form.author || '',
        year: form.year || '',
        journal: form.journal || '',
        slug,
      });

      setForm(emptyForm);
      setMsg('精读记录已创建');
      await loadEntries();
    } catch (e: any) { setMsg(e.message); }
  };

  const remove = async (slug: string, title: string) => {
    if (!confirm(`确定删除精读记录"${title}"吗？此操作不可撤销。`)) return;
    try {
      // Delete the individual .md file
      const mdPath = `docs/papers/summaries/${slug}.md`;
      if (await fileExists(mdPath)) {
        await deleteFile(mdPath);
      }
      // Remove row from summary.md table
      await removeTableRow(slug);
      setMsg('精读记录已删除');
      await loadEntries();
    } catch (e: any) { setMsg(e.message); }
  };

  // --- Table management helpers ---

  const upsertTableRow = async (entry: { title: string; author: string; year: string; journal: string; slug: string }) => {
    let content = '';
    try { content = await readFile('docs/papers/summary.md'); } catch {
      content = generateSummaryTemplate();
    }
    const link = `[${entry.title}](/papers/summaries/${entry.slug})`;
    const newRow = `| ${link} | ${entry.author || '—'} | ${entry.year || '—'} | ${entry.journal || '—'} |`;

    const tableStart = content.indexOf('| 文献标题 |');
    if (tableStart < 0) {
      // Table header not found — rebuild entire summary.md
      const newContent = generateSummaryTemplate([entry]);
      await writeFile('docs/papers/summary.md', newContent);
      return;
    }
    // Find end of header: the separator line
    const sepIdx = content.indexOf('|---', tableStart);
    const sepEnd = content.indexOf('\n', sepIdx);
    const before = content.slice(0, sepEnd + 1);
    const body = content.slice(sepEnd + 1).replace(/^\n+/, ''); // strip leading blank lines

    // Check if slug already exists → replace row
    const slugPattern = `/papers/summaries/${entry.slug})`;
    const existingIdx = body.indexOf(slugPattern);
    let updatedBody: string;
    if (existingIdx >= 0) {
      const lineStart = body.lastIndexOf('\n', existingIdx);
      const lineEndIdx = body.indexOf('\n', existingIdx);
      const beforeLine = lineStart >= 0 ? body.slice(0, lineStart + 1) : '';
      const afterLine = lineEndIdx >= 0 ? body.slice(lineEndIdx) : '';
      updatedBody = beforeLine + newRow + afterLine;
    } else {
      updatedBody = body + newRow + '\n';
    }

    await writeFile('docs/papers/summary.md', before + updatedBody.trimEnd() + '\n');
  };

  const removeTableRow = async (slug: string) => {
    let content = '';
    try { content = await readFile('docs/papers/summary.md'); } catch { return; }
    const slugPattern = `/papers/summaries/${slug})`;
    const idx = content.indexOf(slugPattern);
    if (idx < 0) return;
    const lineStart = content.lastIndexOf('\n', idx);
    const lineEnd = content.indexOf('\n', idx);
    const newContent = content.slice(0, lineStart) + content.slice(lineEnd);
    await writeFile('docs/papers/summary.md', newContent);
  };

  if (!rootHandle) {
    return (
      <div style={s.panel}>
        <p style={{ marginBottom: 12 }}>需要授权访问项目目录才能管理论文总结。</p>
        <button style={{ ...s.btn, ...s.btnPrimary }} onClick={selectRoot}>选择项目目录</button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 16, padding: '10px 0' }}>
        <span style={s.statBadge}>精读记录 {entries.length} 篇</span>
      </div>

      <h3>添加论文精读记录</h3>
      {msg && <p style={{ color: msg.includes('失败') || msg.includes('不能') ? '#ef4444' : '#22c55e', fontSize: 13, marginBottom: 8 }}>{msg}</p>}

      <div style={s.panel}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <div>
            <label style={s.label}>文献标题 *</label>
            <input style={s.input} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="论文标题" />
          </div>
          <div>
            <label style={s.label}>作者</label>
            <input style={s.input} value={form.author} onChange={e => setForm({ ...form, author: e.target.value })} placeholder="作者，多人用逗号分隔" />
          </div>
          <div>
            <label style={s.label}>年份</label>
            <input style={s.input} value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} placeholder="2024" />
          </div>
          <div>
            <label style={s.label}>期刊</label>
            <input style={s.input} value={form.journal} onChange={e => setForm({ ...form, journal: e.target.value })} placeholder="期刊名称" />
          </div>
        </div>

        <label style={s.label}>研究场景</label>
        <textarea style={{ ...s.textarea, minHeight: 60 }} value={form.scenario} onChange={e => setForm({ ...form, scenario: e.target.value })} placeholder="哪类工程项目（基建 / 制造 / EPC / 智能建造）" />

        <label style={s.label}>核心问题</label>
        <textarea style={{ ...s.textarea, minHeight: 60 }} value={form.coreProblem} onChange={e => setForm({ ...form, coreProblem: e.target.value })} placeholder="现有工程管理存在什么痛点" />

        <label style={s.label}>研究方法</label>
        <textarea style={{ ...s.textarea, minHeight: 60 }} value={form.method} onChange={e => setForm({ ...form, method: e.target.value })} placeholder="定性 / 定量；模型 / 算法 / 案例分析 / 问卷" />

        <label style={s.label}>核心变量 / 评价指标</label>
        <textarea style={s.textarea} value={form.variables} onChange={e => setForm({ ...form, variables: e.target.value })} placeholder="重点摘抄论文中的关键变量和评价指标" />

        <label style={s.label}>研究结论与实践价值</label>
        <textarea style={s.textarea} value={form.conclusion} onChange={e => setForm({ ...form, conclusion: e.target.value })} placeholder="企业 / 项目层面的应用价值" />

        <label style={s.label}>研究局限</label>
        <textarea style={{ ...s.textarea, minHeight: 60 }} value={form.limitations} onChange={e => setForm({ ...form, limitations: e.target.value })} placeholder="论文自身的局限性（可作为创新突破口）" />

        <label style={s.label}>可借鉴内容</label>
        <textarea style={{ ...s.textarea, minHeight: 60 }} value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} placeholder="框架、问卷设计、优化思路、仿真流程等" />

        <div style={{ marginTop: 12 }}>
          <button style={{ ...s.btn, ...s.btnPrimary }} onClick={save}>创建精读记录</button>
        </div>
      </div>

      <h3>已有精读记录</h3>
      <div style={s.panel}>
        {entries.length === 0 && <p style={{ color: '#999' }}>暂无精读记录。</p>}
        {entries.map((e, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--rp-c-divider, #eee)' }}>
            <div>
              <div style={{ fontWeight: 500 }}>{e.title}</div>
              <div style={{ fontSize: 12, color: '#999' }}>{e.author} · {e.year} · {e.journal}</div>
            </div>
            <button style={{ ...s.btn, ...s.btnDanger, flexShrink: 0, marginLeft: 12 }} onClick={() => remove(e.slug, e.title)}>删除</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function generateSummaryTemplate(entries?: { title: string; author: string; year: string; journal: string; slug: string }[]) {
  let header = '# 论文精读总结\n\n';
  header += '> 按阅读时间排列。点击标题查看完整精读内容。\n\n';
  header += '| 文献标题 | 作者 | 年份 | 期刊 |\n';
  header += '|---------|------|------|------|\n';

  if (entries && entries.length > 0) {
    for (const e of entries) {
      const link = `[${e.title}](/papers/summaries/${e.slug})`;
      header += `| ${link} | ${e.author || '—'} | ${e.year || '—'} | ${e.journal || '—'} |\n`;
    }
  }

  return header;
}
