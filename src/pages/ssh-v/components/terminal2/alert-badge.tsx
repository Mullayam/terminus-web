import { useUnreadAlerts } from "@/store/watcherStore";
import { usePanelStore } from "@/store/panelStore";

/** Red unread-alert count on an SSH tab; click opens the Alerts panel. */
export default function AlertBadge({ sessionId }: { sessionId: string }) {
  const unread = useUnreadAlerts(sessionId);
  if (!unread) return null;
  return (
    <span
      onClick={(e) => {
        e.stopPropagation();
        usePanelStore.getState().openPanel("alerts");
      }}
      title={`${unread} unread alert${unread === 1 ? "" : "s"} — click to view`}
      className="ml-1.5 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-semibold leading-none cursor-pointer"
    >
      {unread > 9 ? "9+" : unread}
    </span>
  );
}
