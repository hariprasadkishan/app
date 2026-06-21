const subjects = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'Computer Science', 'Hindi'];
const grades = ['CBSE 8-10', 'CBSE 11-12', 'IIT JEE', 'NEET', 'College', 'Foundation'];
const locations = ['Koramangala', 'Indiranagar', 'HSR Layout', 'Whitefield', 'Electronic City'];
const experiences = ['0-2 years', '3-5 years', '5-10 years', '10+ years'];
const ratingOptions = [
  { label: '5 stars', value: 5 },
  { label: '4+ stars', value: 4 },
  { label: '3+ stars', value: 3 },
];

const getSubjectColorBg = (subject) => {
  const s = subject.toLowerCase();
  if (s.includes('math')) return 'bg-blue-500';
  if (s.includes('phys')) return 'bg-purple-500';
  if (s.includes('bio')) return 'bg-green-500';
  if (s.includes('chem')) return 'bg-orange-500';
  if (s.includes('computer')) return 'bg-teal-500';
  if (s.includes('hindi')) return 'bg-pink-500';
  if (s.includes('english')) return 'bg-amber-500';
  return 'bg-sky-500';
};

const CustomCheckbox = ({ checked, onChange, label, colorDot, icon }) => (
  <label className="flex items-center gap-3 mb-2.5 cursor-pointer group">
    <div className="relative flex items-center justify-center">
      <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} />
      <div className={`w-5 h-5 rounded-[6px] border-2 transition-all duration-200 flex items-center justify-center
        ${checked ? 'bg-navy border-navy' : 'bg-white border-slate-300 group-hover:border-navy/50'}`}>
        <i className={`fa-solid fa-check text-white text-[10px] transition-transform duration-200 ${checked ? 'scale-100' : 'scale-0'}`} />
      </div>
    </div>
    <div className="flex items-center gap-2">
      {colorDot && <span className={`w-2 h-2 rounded-full ${colorDot}`} />}
      {icon && <i className={`fa-solid ${icon} text-slate-400 text-xs`} />}
      <span className={`text-sm font-medium transition-colors ${checked ? 'text-navy' : 'text-slate-600 group-hover:text-navy'}`}>
        {label}
      </span>
    </div>
  </label>
);

const FilterPanel = ({ filters, onFilterChange, onReset }) => {
  const SectionTitle = ({ icon, text }) => (
    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
      <i className={`fa-solid ${icon} text-slate-400 text-sm`} />
      <h4 className="text-[11px] font-bold text-navy/70 uppercase tracking-widest">{text}</h4>
    </div>
  );

  return (
    <div className="bg-white rounded-brand shadow-sm border border-slate-200 p-6 sticky top-20">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <i className="fa-solid fa-filter text-navy" />
          <h3 className="font-sora font-extrabold text-navy text-lg">Filters</h3>
        </div>
        <button onClick={onReset} className="text-xs font-bold text-amber hover:text-amber-hover transition">
          Reset All
        </button>
      </div>

      {/* Subject */}
      <div className="mb-6">
        <SectionTitle icon="fa-book" text="Subject" />
        <div className="space-y-1">
          {subjects.map((s) => (
            <CustomCheckbox
              key={s}
              label={s}
              colorDot={getSubjectColorBg(s)}
              checked={filters.subjects?.includes(s) || false}
              onChange={(e) => {
                const curr = filters.subjects || [];
                onFilterChange('subjects', e.target.checked ? [...curr, s] : curr.filter((x) => x !== s));
              }}
            />
          ))}
        </div>
      </div>

      {/* Rating */}
      <div className="mb-6">
        <SectionTitle icon="fa-star" text="Min Rating" />
        <div className="space-y-1">
          {ratingOptions.map((r) => (
            <button
              key={r.value}
              onClick={() => onFilterChange('minRating', r.value)}
              className={`flex items-center gap-2 py-1.5 px-2 w-full text-left text-sm transition rounded-lg ${
                filters.minRating === r.value ? 'bg-amber/10' : 'hover:bg-slate-50'
              }`}
            >
              <div className="flex gap-0.5">
                {Array.from({ length: r.value }, (_, i) => <i key={i} className="fa-solid fa-star text-amber text-xs" />)}
                {Array.from({ length: 5 - r.value }, (_, i) => <i key={i} className="far fa-star text-amber/30 text-xs" />)}
              </div>
              <span className={`font-semibold ml-1 ${filters.minRating === r.value ? 'text-amber-hover' : 'text-slate-600'}`}>
                {r.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Price */}
      <div className="mb-6">
        <SectionTitle icon="fa-indian-rupee-sign" text="Price Range" />
        <div className="flex items-center gap-3 mt-4">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">₹</span>
            <input
              type="number"
              placeholder="Min"
              value={filters.minPrice || ''}
              onChange={(e) => onFilterChange('minPrice', e.target.value)}
              className="w-full border-2 border-slate-200 rounded-lg py-2 pl-7 pr-3 text-sm font-semibold outline-none focus:border-navy transition"
            />
          </div>
          <span className="text-sm font-semibold text-slate-400">to</span>
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">₹</span>
            <input
              type="number"
              placeholder="Max"
              value={filters.maxPrice || ''}
              onChange={(e) => onFilterChange('maxPrice', e.target.value)}
              className="w-full border-2 border-slate-200 rounded-lg py-2 pl-7 pr-3 text-sm font-semibold outline-none focus:border-navy transition"
            />
          </div>
        </div>
      </div>

      {/* Location */}
      <div className="mb-6">
        <SectionTitle icon="fa-map-location-dot" text="Location" />
        <div className="space-y-1">
          {locations.map((l) => (
            <CustomCheckbox
              key={l}
              label={l}
              icon="fa-location-dot"
              checked={filters.locations?.includes(l) || false}
              onChange={(e) => {
                const curr = filters.locations || [];
                onFilterChange('locations', e.target.checked ? [...curr, l] : curr.filter((x) => x !== l));
              }}
            />
          ))}
        </div>
      </div>

      {/* Experience */}
      <div className="mb-6">
        <SectionTitle icon="fa-briefcase" text="Experience" />
        <div className="space-y-1">
          {experiences.map((ex) => (
            <CustomCheckbox
              key={ex}
              label={ex}
              icon="fa-calendar"
              checked={filters.experience?.includes(ex) || false}
              onChange={(e) => {
                const curr = filters.experience || [];
                onFilterChange('experience', e.target.checked ? [...curr, ex] : curr.filter((x) => x !== ex));
              }}
            />
          ))}
        </div>
      </div>

      <button
        onClick={onReset}
        className="w-full py-3 border-2 border-navy text-navy rounded-lg text-sm font-bold hover:bg-navy hover:text-white transition-all flex items-center justify-center gap-2"
      >
        <i className="fa-solid fa-rotate-right" /> Reset All Filters
      </button>
    </div>
  );
};
export default FilterPanel;
