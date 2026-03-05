/**
 * KickedModal — shown when admin kicks the user.
 * Has a "Rejoin" button to attempt to reconnect.
 */
import { useCollabStore } from '../store';

interface KickedModalProps {
  onRejoin: () => void;
}

export function KickedModal({ onRejoin }: KickedModalProps) {
  const message = useCollabStore((s) => s.kickedMessage);
  const dismiss = useCollabStore((s) => s.setKickedMessage);

  if (!message) return null;

  const handleRejoin = () => {
    dismiss(null);
    onRejoin();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#1e1e2e] border border-gray-700 rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-100 mb-2">Removed from Session</h2>
        <p className="text-sm text-gray-400 mb-6">{message}</p>
        <button
          onClick={handleRejoin}
          className="w-full py-2 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-colors"
        >
          Rejoin Session
        </button>
      </div>
    </div>
  );
}
