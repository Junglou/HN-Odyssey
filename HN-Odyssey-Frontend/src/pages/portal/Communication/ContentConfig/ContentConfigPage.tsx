// imports
import ContentConfig from "../../../../components/portal/Communication/ContentConfig/ContentConfig";
import { useContentConfig } from "../../../../hooks/portal/Communication/ContentConfig/useContentConfig";
import "./ContentConfigPage.css";

// container
export default function ContentConfigPage() {
  const {
    selectedPage,
    selectedSectionId,
    currentSection,
    selectedElementId,
    availableSections,
    activeElementData,
    actions,
  } = useContentConfig();

  // render
  return (
    <div className="cc-page-container">
      <ContentConfig
        selectedPage={selectedPage}
        selectedSectionId={selectedSectionId}
        currentSection={currentSection}
        selectedElementId={selectedElementId}
        availableSections={availableSections}
        activeElementData={activeElementData}
        actions={actions}
      />
    </div>
  );
}
