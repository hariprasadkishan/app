import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { tutors as allTutors } from '../data/tutors';
import AnimatedSearchBar from '../components/student/AnimatedSearchBar';
import FilterPanel from '../components/student/FilterPanel';
import SortDropdown from '../components/student/SortDropdown';
import TutorCard from '../components/shared/TutorCard';
import Pagination from '../components/shared/Pagination';

const PER_PAGE = 6;

// Lightweight animated counter hook
const useAnimatedCount = (target) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = count;
    if (start === target) return;
    const duration = 500;
    const startTime = performance.now();
    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutExpo
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setCount(Math.floor(start + (target - start) * easeProgress));
      if (progress < 1) requestAnimationFrame(animate);
      else setCount(target);
    };
    requestAnimationFrame(animate);
  }, [target]); // intentionally excluding count from deps
  return count;
};

const StudentDiscover = () => {
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('subject') || '');
  const [sortBy, setSortBy] = useState('recommended');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    subjects: searchParams.get('subject') ? [searchParams.get('subject')] : [],
    minRating: null,
    minPrice: '',
    maxPrice: '',
    locations: [],
    experience: [],
  });

  useEffect(() => { document.title = 'Discover Tutors — TrueEdu'; }, []);

  useEffect(() => {
    if (searchParams.get('subject')) {
      const sub = searchParams.get('subject');
      setSearchQuery(sub);
      setFilters(prev => ({ ...prev, subjects: [sub] }));
    }
  }, [searchParams]);

  const handleFilterChange = (key, val) => {
    setFilters((prev) => ({ ...prev, [key]: val }));
    setPage(1);
  };

  const handleReset = () => {
    setFilters({ subjects: [], minRating: null, minPrice: '', maxPrice: '', locations: [], experience: [] });
    setSearchQuery('');
    setPage(1);
  };

  const handleSearch = ({ subject, topic }) => {
    const q = subject || topic || '';
    setSearchQuery(q);
    setPage(1);
  };

  const filtered = useMemo(() => {
    let list = [...allTutors];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((t) =>
        t.name.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q)) ||
        t.location.toLowerCase().includes(q)
      );
    }

    if (filters.subjects.length > 0) {
      list = list.filter((t) => filters.subjects.some((s) => t.subject.includes(s)));
    }
    if (filters.minRating) {
      list = list.filter((t) => t.rating >= filters.minRating);
    }
    if (filters.minPrice) {
      list = list.filter((t) => t.price >= Number(filters.minPrice));
    }
    if (filters.maxPrice) {
      list = list.filter((t) => t.price <= Number(filters.maxPrice));
    }
    if (filters.locations.length > 0) {
      list = list.filter((t) => filters.locations.some((l) => t.location.includes(l)));
    }
    if (filters.experience.length > 0) {
      list = list.filter((t) => filters.experience.some((e) => t.experience.includes(e)));
    }

    switch (sortBy) {
      case 'toprated': list.sort((a, b) => b.rating - a.rating); break;
      case 'pricelowtohigh': list.sort((a, b) => a.price - b.price); break;
      case 'pricehightolow': list.sort((a, b) => b.price - a.price); break;
      case 'mostexperienced': list.sort((a, b) => parseInt(b.experience) - parseInt(a.experience)); break;
      default: list.sort((a, b) => b.rating - a.rating);
    }

    return list;
  }, [searchQuery, filters, sortBy]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  
  const animatedCount = useAnimatedCount(filtered.length);
  const activeFiltersCount = Object.values(filters).flat().filter(Boolean).length;

  return (
    <div className="relative min-h-screen">
      {/* Subtle grid background */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(to right, #1B2D5B 1px, transparent 1px), linear-gradient(to bottom, #1B2D5B 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      
      <div className="relative z-10">
        <AnimatedSearchBar onSearch={handleSearch} />

        {/* Mobile filter toggle */}
        <button
          onClick={() => setShowFilters(true)}
          className="lg:hidden mb-6 flex items-center justify-center gap-2 bg-white border-2 border-slate-200 rounded-full w-full py-3 text-sm font-bold text-navy shadow-sm hover:border-navy transition"
        >
          <i className="fa-solid fa-sliders" />
          Show Filters
          {activeFiltersCount > 0 && (
            <span className="bg-amber text-navy text-xs px-2 py-0.5 rounded-full ml-1">
              {activeFiltersCount}
            </span>
          )}
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
          {/* Mobile Filter Overlay & Drawer */}
          {showFilters && (
            <div className="fixed inset-0 bg-navy/60 z-50 lg:hidden backdrop-blur-sm transition-opacity" onClick={() => setShowFilters(false)}>
              <div className="absolute top-0 left-0 w-[85%] max-w-[320px] h-full bg-cream overflow-y-auto shadow-2xl animate-slide-in-right" onClick={e => e.stopPropagation()}>
                <div className="sticky top-0 bg-white p-4 border-b border-slate-200 flex justify-end z-10">
                  <button onClick={() => setShowFilters(false)} className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded-full text-slate-500 hover:text-navy hover:bg-slate-200 transition">
                    <i className="fa-solid fa-xmark" />
                  </button>
                </div>
                <div className="p-4">
                  <FilterPanel filters={filters} onFilterChange={handleFilterChange} onReset={handleReset} />
                </div>
              </div>
            </div>
          )}

          {/* Desktop Filter Panel */}
          <div className="hidden lg:block">
            <FilterPanel filters={filters} onFilterChange={handleFilterChange} onReset={handleReset} />
          </div>

          {/* Results */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 bg-white p-4 rounded-brand shadow-sm border border-slate-100">
              <p className="text-sm font-semibold text-slate-500">
                Showing <span className="text-navy font-extrabold text-lg bg-slate-100 px-2 py-0.5 rounded-md mx-1">{animatedCount}</span> matching tutors
              </p>
              <SortDropdown value={sortBy} onChange={(v) => { setSortBy(v); setPage(1); }} />
            </div>

            {paginated.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {paginated.map((t) => <TutorCard key={t.id} tutor={t} />)}
              </div>
            ) : (
              <div className="flex flex-col items-center text-center py-16 bg-white rounded-brand shadow-sm border border-slate-100">
                <span className="text-6xl mb-4">🔍</span>
                <h3 className="text-xl font-semibold text-navy mb-2">No teachers found</h3>
                <p className="text-slate-500 text-sm max-w-md mx-auto mb-6">Try adjusting your filters or search for a different subject</p>
                <button onClick={handleReset} className="py-2.5 px-6 bg-navy text-white rounded-lg text-sm font-bold hover:bg-navy-light transition shadow-md">
                  Reset Filters
                </button>
              </div>
            )}

            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </div>
      </div>
    </div>
  );
};
export default StudentDiscover;
