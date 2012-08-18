"use strict"


 //  Utils
////////////////////////////////////////////////////////////////////////////////
function log(object){
	var args = Array.prototype.slice.call(arguments);
	if(args.length > 1)
		console.log(args);
	else
		console.log(object);
}


function sendMessage(message, callback){
	if(callback)
		chrome.extension.sendMessage(undefined, message, callback);
	else
		chrome.extension.sendMessage(undefined, message);
};

function getWindowByTab(tab, callback){
	if(typeof callback == "function"){
		if(tab && tab.windowId !== undefined){
			chrome.windows.get(tab.windowId, {populate : true}, function(window){
				callback(window);
			});
		}
	}
}

function isNormalWindow(window, callback){
	if(typeof callback == "function"){
		if(window && window.type == "normal"){
			var args = Array.prototype.slice.call(arguments).slice(2);
			callback.apply(null, args);
		}
	}
}

function isNumber(object){
	return !isNaN(parseInt(object));
}
	
function clear(){
	chrome.storage.local.clear();
}


 // Init
////////////////////////////////////////////////////////////////////////////////
//chrome.storage.local.clear();
var model = new Model(null, true);
var control = model.getControl();



 //  Setup Tab Events
////////////////////////////////////////////////////////////////////////////////
chrome.windows.onCreated.addListener(function(window){
	isNormalWindow(window, control.createGroup, window, window.id);
});

chrome.windows.onRemoved.addListener(function(windowId){
	var groupId = control.getGroupId(windowId);
	if(isNumber(groupId)){
		if(control.getIndex(groupId).length > 0){
			control.updateGroup({chromeId : null}, groupId);
		}
		else{
			control.removeGroup(groupId);
		}
	}
});

chrome.tabs.onAttached.addListener(function(tabId, info){
	var groupId = control.getGroupId(info.newWindowId);
	if(isNumber(groupId)){
		var pageId = control.getPageId(tabId);
		control.attachPage(pageId, groupId, info.newPosition);
	}
});

chrome.tabs.onCreated.addListener(function(tab){
	var groupId = control.getGroupId(tab.windowId);
	if(isNumber(groupId)){
		control.createPage(tab, groupId, tab.id);
	}
});

chrome.tabs.onDetached.addListener(function(tabId, info){
	var groupId = control.getGroupId(info.oldWindowId);
	var pageId = control.getPageId(tabId);
	if(isNumber(groupId) && isNumber(pageId)){
		control.detachPage(pageId, groupId, info.oldPosition);
	}
});

chrome.tabs.onMoved.addListener(function(tabId, info){
	var groupId = control.getGroupId(info.windowId);
	var pageId = control.getPageId(tabId);
	if(isNumber(groupId) && isNumber(pageId)){
		control.movePage(pageId, groupId, info.fromIndex, info.toIndex);
	}
});

chrome.tabs.onRemoved.addListener(function(tabId, info){
	var pageId = control.getPageId(tabId);
	if(isNumber(pageId)){
		if(info.isWindowClosing){
			control.updatePage({chromeId : null}, pageId);
		}
		else{
			control.removePage(pageId);
		}
	}
});

chrome.tabs.onUpdated.addListener(function(tabId, info, tab){
	var pageId = control.getPageId(tabId);
	if(isNumber(pageId)){
		control.updatePage(tab, pageId);
	}
});



 //  Message
////////////////////////////////////////////////////////////////////////////////
var messageHandler = {};
	messageHandler["activate-page"] = function(args){
		var tabId = control.getTabId(args.pageId);
		if(tabId !== undefined){
			chrome.tabs.update(tabId, {active : true});
			chrome.tabs.get(tabId, function(tab){
				chrome.windows.update(tab.windowId, {focused : true});
			});
		}
		else{
			//TODO
		}
	}
chrome.extension.onMessage.addListener(function(message){
	if(message.action in messageHandler)
		messageHandler[message.action](message);
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
