import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 py-4
      ${scrolled ? 'bg-cream/95 backdrop-blur-md shadow-[0_1px_10px_rgba(15,43,77,0.06)]' : 'bg-transparent'}`}>
      <div className="max-w-[1100px] mx-auto px-6 flex items-center justify-between">
        <Link to="/">
          <img src="/logo.png" alt="TrueEdu logo" className="h-10 w-auto" loading="lazy" />
        </Link>
        <div className="hidden md:flex items-center gap-8">
          <Link to="/#how" onClick={() => scrollTo('how')} className="text-navy/70 text-sm font-medium hover:text-navy transition">How it Works</Link>
          <Link to="/#for-students" onClick={() => scrollTo('for-students')} className="text-navy/70 text-sm font-medium hover:text-navy transition">For Students</Link>
          <Link to="/#for-teachers" onClick={() => scrollTo('for-teachers')} className="text-navy/70 text-sm font-medium hover:text-navy transition">For Teachers</Link>
          <Link to="/login" className="bg-navy text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-navy-light transition">
            Get Started
          </Link>
        </div>
        <Link to="/login" className="md:hidden bg-navy text-white px-4 py-1.5 rounded-lg text-sm font-semibold">
          Get Started
        </Link>
      </div>
    </nav>
  );
};
export default Navbar;
