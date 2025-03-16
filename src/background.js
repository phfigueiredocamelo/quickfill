// Background script for the iAutoFill extension

// Listen for installation events
chrome.runtime.onInstalled.addListener((details) => {
	if (details.reason === "install") {
		// Initialize default settings on installation
		chrome.storage.sync.set({
			enabled: false,
			apiKey: "",
			contextData: "",
			customFields: {},
		});

		// Open the options page on installation
		chrome.tabs.create({
			url: "popup.html",
		});
	}
});

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	// Handle specific message types
	if (message.action === "getSettings") {
		chrome.storage.sync.get(
			{
				enabled: true,
				apiKey: "",
				contextData: "",
				customFields: {},
			},
			(items) => {
				sendResponse(items);
			},
		);
		return true; // Indicates async response
	}
});

// Context menu for filling forms
chrome.contextMenus?.create({
	id: "fill-form",
	title: "Fill Form with QuickFill",
	contexts: ["page", "editable"],
});

// Handle context menu clicks
chrome.contextMenus?.onClicked.addListener((info, tab) => {
	if (info.menuItemId === "fill-form" && tab?.id) {
		chrome.tabs.sendMessage(tab.id, { action: "fillForms" });
	}
});
