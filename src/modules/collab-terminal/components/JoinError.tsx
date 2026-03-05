/**
 * JoinError — shown when the join request is rejected.
 */
import { AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCollabStore } from '../store';

export function JoinError() {
  const error = useCollabStore((s) => s.joinError);
  const navigate = useNavigate();

  if (!error) return null;

  return (
    <div className="flex items-center justify-center h-full bg-[#0a0a0a]">
      <div className="flex flex-col items-center gap-4 max-w-sm text-center px-4">
        <AlertTriangle size={40} className="text-red-400" />
        <h2 className="text-lg font-semibold text-gray-100">Cannot Join Session</h2>
        <p className="text-sm text-gray-400">{error.message}</p>
        <button
          onClick={() => navigate('/')}
          className="mt-2 px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm transition-colors"
        >
          Go Home
        </button>
      </div>
    </div>
  );
}
