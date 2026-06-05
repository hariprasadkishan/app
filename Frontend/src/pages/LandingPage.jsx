import { useEffect } from 'react';
import Hero from '../components/landing/Hero';
import HowItWorks from '../components/landing/HowItWorks';
import ForWhom from '../components/landing/ForWhom';
import RefundPolicy from '../components/landing/RefundPolicy';
import TrustStats from '../components/landing/TrustStats';
import CTASection from '../components/landing/CTASection';

const LandingPage = () => {
  useEffect(() => { document.title = 'TrueEdu — Find Your Perfect Tutor'; }, []);

  return (
    <>
      <Hero />
      <HowItWorks />
      <ForWhom />
      <RefundPolicy />
      <TrustStats />
      <CTASection />
    </>
  );
};
export default LandingPage;
