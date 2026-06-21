import { Link } from 'react-router-dom';

const Footer = () => {
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <footer className="bg-navy text-white/60 py-12 px-6">
      <div className="max-w-[1100px] mx-auto grid grid-cols-1 md:grid-cols-4 gap-10">
        {/* Brand */}
        <div>
          <span className="font-sora text-xl font-bold inline-block mb-3">
            <span className="text-white">True</span><span className="text-amber">Ed</span>
          </span>
          <p className="text-sm leading-relaxed max-w-[280px]">
            India's trusted platform for verified tutoring. Connecting students with checked teachers since {new Date().getFullYear()}.
          </p>
        </div>

        {/* For Students */}
        <div>
          <h4 className="text-white font-sora text-sm font-semibold mb-5">For Students</h4>
          <Link to="/login?role=student" className="block text-white/60 text-sm mb-3 hover:text-amber transition">Find a Teacher</Link>
          <Link to="/#how" onClick={() => scrollTo('how')} className="block text-white/60 text-sm mb-3 hover:text-amber transition">How it Works</Link>
          <Link to="/safety" className="block text-white/60 text-sm mb-3 hover:text-amber transition">Safety</Link>
          <Link to="/#refund-policy" onClick={() => scrollTo('refund-policy')} className="block text-white/60 text-sm mb-3 hover:text-amber transition">Refund Policy</Link>
        </div>

        {/* For Teachers */}
        <div>
          <h4 className="text-white font-sora text-sm font-semibold mb-5">For Teachers</h4>
          <Link to="/login?role=teacher" className="block text-white/60 text-sm mb-3 hover:text-amber transition">Become a Teacher</Link>
          <Link to="/teacher/earnings-info" className="block text-white/60 text-sm mb-3 hover:text-amber transition">Earnings</Link>
          <Link to="/teacher/verification" className="block text-white/60 text-sm mb-3 hover:text-amber transition">Verification</Link>
          <Link to="/community" className="block text-white/60 text-sm mb-3 hover:text-amber transition">Community</Link>
        </div>

        {/* Company */}
        <div>
          <h4 className="text-white font-sora text-sm font-semibold mb-5">Company</h4>
          <Link to="/about" className="block text-white/60 text-sm mb-3 hover:text-amber transition">About Us</Link>
          <Link to="/contact" className="block text-white/60 text-sm mb-3 hover:text-amber transition">Contact</Link>
          <Link to="/privacy" className="block text-white/60 text-sm mb-3 hover:text-amber transition">Privacy Policy</Link>
          <Link to="/terms" className="block text-white/60 text-sm mb-3 hover:text-amber transition">Terms of Service</Link>
        </div>
      </div>
      <div className="max-w-[1100px] mx-auto mt-8 pt-8 border-t border-white/10 text-center text-xs text-white/40">
        © {new Date().getFullYear()} TrueEd. All rights reserved. Built in India 🇮🇳
      </div>
    </footer>
  );
};
export default Footer;
