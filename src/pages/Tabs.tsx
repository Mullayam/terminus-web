import { useState } from "react";
import XTerminal from "./ssh/Terminal";

const TerminalTabs = () => {
  const [tabs, setTabs] = useState([{ id: 1, title: "Terminal 1" }]); // Initial tab
  const [activeTab, setActiveTab] = useState(1);

  // Add a new tab
  const addTab = () => {
    const newTabId = tabs.length + 1;
    setTabs([...tabs, { id: newTabId, title: `Terminal ${newTabId}` }]);
    setActiveTab(newTabId); // Set the new tab as active
  };

  // Remove a tab
  const removeTab = (id: number) => {
    setTabs(tabs.filter((tab) => tab.id !== id));
    if (id === activeTab && tabs.length > 1) {
      setActiveTab(tabs[tabs.length - 2].id); // Set to previous tab if the active one is removed
    }
  };

  // Render the tab buttons
  const renderTabs = () => {
    return tabs.map((tab) => (
      <button
        key={tab.id}
        onClick={() => setActiveTab(tab.id)}
        className={`px-4 py-2 ${activeTab === tab.id ? "bg-gray-800 text-white" : "bg-gray-300 text-black"}`}
      >
        {tab.title}{" "}
        <span onClick={() => removeTab(tab.id)} className="ml-2 text-red-500 cursor-pointer">
          ✕
        </span>
      </button>
    ));
  };

  // Render the active terminal
  const renderActiveTerminal = () => {
    return tabs.map((tab) => {
      if (tab.id === activeTab) {
        return (
          <div key={tab.id} style={{ height: '300px', marginTop: '10px' }}>
            <XTerminal key={tab.id} /> {/* Render separate XTerminal instance */}
          </div>
        );
      }
      return null;
    });
  };

  return (
    <div className="w-full">
      <div className="bg-gray-900 p-2 flex">
        {renderTabs()}
        <button onClick={addTab} className="ml-2 px-4 py-2 bg-green-500 text-white">
          + New Tab
        </button>
      </div>
      <div className="p-2 bg-gray-800">{renderActiveTerminal()}</div>
    </div>
  );
};

export default TerminalTabs;
