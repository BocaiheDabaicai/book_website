export function PDFLink({ href }: { href: string }) {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10,
    padding: '13px 24px',
    background: 'linear-gradient(135deg, #f5f5f7 0%, #e8e8ed 100%)',
    border: '1px solid rgba(0,0,0,0.06)',
    borderRadius: 16,
    color: '#1d1d1f',
    fontSize: 15,
    fontWeight: 500,
    textDecoration: 'none',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04)',
    transition: 'all 0.2s ease',
    margin: '8px 0 20px',
    cursor: 'pointer',
  };

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={base}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.background = 'linear-gradient(135deg, #ebebf0 0%, #dedee3 100%)';
        (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 2px 6px rgba(0,0,0,0.06), 0 6px 20px rgba(0,0,0,0.06)';
        (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.background = 'linear-gradient(135deg, #f5f5f7 0%, #e8e8ed 100%)';
        (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04)';
        (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)';
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="18" x2="12" y2="12" />
        <polyline points="9 15 12 18 15 15" />
      </svg>
      <span>打开 PDF 文件</span>
    </a>
  );
}
