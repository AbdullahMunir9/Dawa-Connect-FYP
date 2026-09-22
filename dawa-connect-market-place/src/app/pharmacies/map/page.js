import HealthcareMapExplorer from '@/components/HealthcareMapExplorer';

export const metadata = {
  title: 'Find Nearby Care | DAWA Connect',
  description: 'Find nearby DAWA Connect pharmacies, hospitals and clinics, and plan your journey. Open to everyone.'
};

export default function PharmaciesMapPage() {
  return <HealthcareMapExplorer />;
}
