'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function FaceEnrollmentRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/pairing?tab=face');
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
      <Loader2 size={36} className="text-violet-600 animate-spin" />
      <p className="text-sm font-semibold text-gray-500">Membuka Face AI Enrollment...</p>
    </div>
  );
}
