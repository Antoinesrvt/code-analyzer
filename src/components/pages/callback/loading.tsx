export function CallbackLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="mb-4 text-2xl font-semibold text-gray-900">
          Initializing...
        </div>
        <div className="text-sm text-gray-600 mb-4">
          Preparing authentication
        </div>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    </div>
  );
} 