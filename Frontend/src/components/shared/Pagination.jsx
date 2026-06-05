const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...');
    }
  }

  const btn = 'w-10 h-10 flex items-center justify-center rounded-full text-sm font-bold transition shadow-sm';

  return (
    <div className="flex items-center justify-center gap-2 mt-10">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className={`${btn} border-2 border-slate-200 bg-white text-navy hover:border-navy hover:text-navy disabled:opacity-40 disabled:hover:border-slate-200`}
      >
        <i className="fa-solid fa-chevron-left text-[11px]" />
      </button>

      {pages.map((p, i) =>
        p === '...' ? (
          <span key={i} className="text-muted text-sm px-2 font-bold">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`${btn} ${p === currentPage ? 'bg-navy text-white shadow-md scale-110' : 'bg-white text-slate-600 border-2 border-slate-200 hover:border-navy hover:text-navy'}`}
          >
            {p}
          </button>
        )
      )}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={`${btn} border-2 border-slate-200 bg-white text-navy hover:border-navy hover:text-navy disabled:opacity-40 disabled:hover:border-slate-200`}
      >
        <i className="fa-solid fa-chevron-right text-[11px]" />
      </button>
    </div>
  );
};
export default Pagination;
