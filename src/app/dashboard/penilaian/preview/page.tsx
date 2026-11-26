import { Suspense } from 'react';
import { RefreshCw } from 'lucide-react';
import RaportPreviewClient from '@/components/penilaian/RaportPreviewClient';

export default function RaportPreviewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <RefreshCw size={32} className="animate-spin text-amber-600" />
        </div>
      }
    >
      <RaportPreviewClient />
    </Suspense>
  );
}
