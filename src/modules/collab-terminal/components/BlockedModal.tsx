/**
 * BlockedModal — shown when admin blocks the user.
 * No rejoin — just an OK that navigates away.
 */
import { useNavigate } from 'react-router-dom';
import { useCollabStore } from '../store';

export function BlockedModal() {
  const message = useCollabStore((s) => s.blockedMessage);
  const navigate = useNavigate();

  if (!message) return null;

  const handleOk = () => {
    navigate('/');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#1e1e2e] border border-red-800/50 rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
        <h2 className="text-lg font-semibold text-red-300 mb-2">Blocked</h2>
        <p className="text-sm text-gray-400 mb-6">{message}</p>
        <button
          onClick={handleOk}
          className="w-full py-2 rounded bg-red-700 hover:bg-red-600 text-white font-medium text-sm transition-colors"
        >
          OK
        </button>
      </div>
    </div>
  );
}
