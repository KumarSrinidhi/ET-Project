import { type ReactNode } from 'react';

interface Props {
  loading: boolean;
  error: string | null;
  loadingMessage?: string;
  children: ReactNode;
}

export default function DashboardShell({ loading, error, loadingMessage, children }: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-500">{loadingMessage || 'Loading...'}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-700 font-medium">Failed to load data</p>
        <p className="text-red-500 text-sm mt-1">{error}</p>
      </div>
    );
  }

  return <>{children}</>;
}
