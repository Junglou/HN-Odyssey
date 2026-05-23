import { useLiveChatSupport } from "../../../../hooks/portal/CustomerCRM/LiveChatSupport/useLiveChatSupport";
import LiveChatSupport from "../../../../components/portal/CustomerCRM/LiveChatSupport/LiveChatSupport";

export default function LiveChatSupportPage() {
  const chatLogic = useLiveChatSupport();

  return (
    <LiveChatSupport
      filteredSessions={chatLogic.sessions}
      hasMore={chatLogic.hasMore}
      activeTab={chatLogic.activeTab}
      searchQuery={chatLogic.searchQuery}
      activeSessionId={chatLogic.activeSessionId}
      activeSession={chatLogic.activeSession}
      tabCounts={chatLogic.tabCounts}
      actions={chatLogic.actions}
      typingUsers={chatLogic.typingUsers}
    />
  );
}
