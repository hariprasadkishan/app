const StarRating = ({ rating, size = 'sm', showCount, count }) => {
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';
  const stars = Array.from({ length: 5 }, (_, i) => {
    if (rating >= i + 1) return 'full';
    if (rating >= i + 0.5) return 'half';
    return 'empty';
  });
  return (
    <span className="inline-flex items-center gap-0.5">
      {stars.map((s, i) => (
        <i
          key={i}
          className={`${textSize} ${
            s === 'empty'
              ? 'far fa-star text-slate-300'
              : s === 'half'
              ? 'fa-solid fa-star-half-stroke text-amber'
              : 'fa-solid fa-star text-amber'
          }`}
        />
      ))}
      {showCount && count != null && (
        <span className={`${textSize} text-muted ml-1`}>({count})</span>
      )}
    </span>
  );
};
export default StarRating;
