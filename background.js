"use strict"

 //  Global Variable
////////////////////////////////////////////////////////////////////////////////




var windowManager = (function(){
	var that = {};
	
	var groups = [];
	var mapWin = [];
	var mapTab = [];
	
	(function init(){
		
	})();
	
	function dispatch(eventType){
		var argv = Array.prototype.slice.call(arguments).slice(1);
		function run(implement){
			implement.apply(null, argv);
		}
		that.args = argv;
		chrome.extension.sendMessage(null, {eventType : eventType});
	}
	
	function Group(window){
		this.id = window.id;
		this.tabs = [];
		return this;
	}
	
	function Tab(tab, exist){
		//called from new then create 'this',
		//called as normal function then modify 'exist' or return a new one
		var that = this instanceof Tab ? this : exist || {};
		that.id = tab.id;
		that.url = tab.url;
		that.title = tab.title;
		that.pinned = tab.pinned;
		that.group = tab.group || mapWin[tab.windowId];
		return that;		
	}
	
	function getGroups(){
		return groups;
	}
	
	function getWindowById(windowId){
		return mapWin[windowId];
	}
	
	function getTabById(tabId){
		return mapTab[tabId];
	}
	
	function createWindow(window){
		var group = new Group(window);
		var winIndex = groups.push(group) - 1;
		mapWin[window.id] = group;
		dispatch("create window", winIndex, group);
	}
	
	function removeWindow(window){
		var winIndex = groups.indexOf(window);
		console.log(winIndex);
		delete groups[winIndex];
		dispatch("remove window", winIndex);
	}
	
	function attachTab(tab, group, tabIndex){
		var winIndex = groups.indexOf(group);
		group.tabs.splice(tabIndex, 0, tab);
		dispatch("insert tab", winIndex, tabIndex, tab);
	}
	
	function createTab(tab){
		var group = mapWin[tab.windowId];
		var page = new Tab(tab);		
		var winIndex = groups.indexOf(group);
		var tabIndex = tab.index;
		groups[winIndex].tabs[tabIndex] = page;
		mapTab[tab.id] = page;
		dispatch("insert tab", winIndex, tabIndex, page);
	}
	
	function detachTab(tab, group, tabIndex){
		group.tabs.splice(tabIndex, 1);
		var winIndex = groups.indexOf(group);
		dispatch("remove tab", winIndex, tabIndex);
	}
	
	function moveTab(tab, oldIndex, newIndex){
		var group = tab.group;
		group.tabs.splice(oldIndex, 1);
		group.tabs.splice(newIndex, 0, tab);
		var winIndex = groups.indexOf(group);
		dispatch("move tab", winIndex, oldIndex, newIndex);
	}
	
	function removeTab(tab){
		var group = tab.group;
		var winIndex = groups.indexOf(group);
		var tabIndex = group.tabs.indexOf(tab);
		group.tabs.splice(tabIndex, 1);
		dispatch("remove tab", winIndex, tabIndex);
	}
	
	function updateTab(tab){
		var group = tab.group;
		var winIndex = groups.indexOf(group);
		var tabIndex = group.tabs.indexOf(tab);
		dispatch("update tab", winIndex, tabIndex, tab);
	}
	
	that.Group = Group;
	that.Tab = Tab;
	
	that.getGroups = getGroups;
	that.addEventListener = addEventListener;
	that.getWindowById = getWindowById;
	that.getTabById = getTabById;
	that.createWindow = createWindow;
	that.removeWindow = removeWindow;
	that.attachTab = attachTab;
	that.createTab = createTab;
	that.detachTab = detachTab;
	that.moveTab = moveTab;
	that.removeTab = removeTab;
	that.updateTab = updateTab;
	
	return that;
})();


 //  Utils
////////////////////////////////////////////////////////////////////////////////
function sendMessage(message, callback){
	if(callback)
		chrome.extension.sendMessage(undefined, message, callback);
	else
		chrome.extension.sendMessage(undefined, message);
};

function getWindowByTab(tab, callback){
	if(callback instanceof Function){
		if(tab && tab.windowId){
			chrome.windows.get(tab.windowId, {populate : true}, function(window){
				callback(window);
			});
		}
	}
}




 // Init
////////////////////////////////////////////////////////////////////////////////




 //  Setup Tab Events
////////////////////////////////////////////////////////////////////////////////
chrome.windows.onCreated.addListener(function(window){
	if(window.type == "normal"){
		windowManager.createWindow(window);
	}
});

chrome.windows.onRemoved.addListener(function(windowId){
	var window = windowManager.getWindowById(windowId)
	if(window){
		windowManager.removeWindow(window);
	}
});

chrome.tabs.onAttached.addListener(function(tabId, info){
	var window = windowManager.getWindowById(info.newWindowId);
	if(window){
		var tab = windowManager.getTabById(tabId);
		windowManager.attachTab(window, info.newPosition, tab);
	}
});

chrome.tabs.onCreated.addListener(function(tab){
	if(windowManager.getWindowById(tab.windowId)){
		windowManager.createTab(tab);
	}
});

chrome.tabs.onDetached.addListener(function(tabId, info){
	var window = windowManager.getWindowById(info.oldWindowId);
	if(window){
		var tab = windowManager.getTabById(tabId);
		windowManager.attachTab(window, info.oldPosition, tab);
	}
});

chrome.tabs.onMoved.addListener(function(id, info){
	var tab = windowManager.getTabById(id);
	if(tab){
		windowManager.moveTab(tab, info.fromIndex, info.toIndex);
	}
});

chrome.tabs.onRemoved.addListener(function(id, info){
	var tab = windowManager.getTabById(id);
	if(tab){
		windowManager.removeTab(tab);
	}
});

chrome.tabs.onUpdated.addListener(function(id, info, tab){
	var exist = windowManager.getTabById(id);
	if(exist){
		tab = windowManager.Tab(tab, exist);
		windowManager.updateTab(tab);
	}
});



 //  Setup Message
////////////////////////////////////////////////////////////////////////////////
chrome.extension.onMessage.addListener(function(object){
});



 //  Setup Browser Action
////////////////////////////////////////////////////////////////////////////////
function getGroups(callback){
	callback(windowManager.getGroups());
}

function openTab(){
	//Activate tab if opened or create one
	chrome.windows.getCurrent({populate : true}, function(window){
		var path = "/popup.html";
		var url = "chrome-extension://" + location.host + path;
		var openedTab = null;
		window.tabs.forEach(function(tab){
		if(tab.url == url){
			openedTab = tab;
		}
		});
		if(openedTab === null){
			//If current tab is new tab, replace it
			chrome.tabs.query({active : true, currentWindow : true}, function(tabs){
				var tab = tabs[0];
				if(tab.url == "chrome://newtab/")
					chrome.tabs.update(tab.id, {url : path});
				else
					chrome.tabs.create({url : path});
			});
		}
		else{
			chrome.tabs.update(openedTab.id, {active : true});
		}
	});
}
chrome.browserAction.onClicked.addListener(openTab);


