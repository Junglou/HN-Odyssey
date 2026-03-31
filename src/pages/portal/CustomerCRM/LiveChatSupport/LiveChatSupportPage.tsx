import { useLiveChatSupport } from "../../../../hooks/portal/CustomerCRM/LiveChatSupport/useLiveChatSupport";
import LiveChatSupport from "../../../../components/portal/CustomerCRM/LiveChatSupport/LiveChatSupport";

export default function LiveChatSupportPage() {
  const chatLogic = useLiveChatSupport();

  return (
    <LiveChatSupport
      filteredSessions={chatLogic.filteredSessions}
      activeTab={chatLogic.activeTab}
      searchQuery={chatLogic.searchQuery}
      activeSessionId={chatLogic.activeSessionId}
      activeSession={chatLogic.activeSession}
      actions={chatLogic.actions}
    />
  );
}
