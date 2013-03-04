"use strict"

var DEBUG;

 //  Utils
////////////////////////////////////////////////////////////////////////////////
function log(object){
	var args = Array.prototype.slice.call(arguments);
	if(args.length > 1)
		console.log(args);
	else
		console.log(object);
}

function debug(object){
	if(DEBUG){
		var args = Array.prototype.slice.call(arguments);
		if(args.length > 1)
			console.debug(args);
		else
			console.debug(object);
	}
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
var control = new Control(null, true);



 //  Process Queue
////////////////////////////////////////////////////////////////////////////////
var processQueue = (function(){
	var that = {};

	var __queue = [];
	
	//Function in queue must call 'next' at each end
	function queue(callback){
		if(typeof callback != "function")
			throw [callback, " is not a function"];
			
		return function(){
			var argv = Array.prototype.slice.call(arguments);
			//Put a lock
			//workaround : __queue[0] is not writable
			var position = __queue.length || 1;
			__queue[position] = {func : callback, argv : argv};
			debug(["inqueue", callback.name, position]);
			if(position == 1){
				debug(["run", callback.name, queue.length]);
				callback.apply(null, argv);
			}
		}
	}
	
	function next(){
		//Take out self
		//workaround : __queue[0] is not writable
		var self = __queue.shift() || __queue.shift();
		debug(["unqueue", self.func.name]);
		//Get next
		var process = __queue[0];
		if(process){
			setTimeout(function(){
				try{
					process.func.apply(null, process.argv);
				} 
				catch(ex){
					console.error(ex);
					that.next();
				}
			}, 0);
		}
	}
	
	that.queue = queue;
	that.next = next;
	
	return that;
})();



 //  Setup Tab Events
////////////////////////////////////////////////////////////////////////////////
function onWindowCreated(window){
	if(window.type == "normal"){
		chrome.windows.get(window.id, {populate : true}, function(window){
			if(window.tabs){
				var groupId = control.findGroupId(window);
				if(groupId != null){
					//Is exists group
					control.updateGroup({chromeId : window.id}, groupId);
					var index = control.getIndex(groupId);
					window.tabs.forEach(function(tab, i){
						control.updatePage({chromeId : tab.id}, index[i]);
					});
				}
				else{
					control.createGroup(window, window.id);
				}
			}
			else{
				control.createGroup(window, window.id);
			}
			
			processQueue.next();
		});
	}
	else{
		processQueue.next();
	}
}

function onWindowRemoved(windowId){
	var groupId = control.getGroupId(windowId);
	if(isNumber(groupId)){
		if(control.getIndex(groupId).length > 0){
			control.updateGroup({chromeId : null}, groupId);
		}
		else{
			control.removeGroup(groupId);
		}
	}
	processQueue.next();
}

function onTabCreated(tab){
	var groupId = control.getGroupId(tab.windowId);
	var pageId = control.getPageId(tab.id);
	if(isNumber(groupId) && !isNumber(pageId)){
		control.createPage(tab, groupId, tab.id);
	}
	processQueue.next();
}

function onTabRemoved(tabId, info){
	var pageId = control.getPageId(tabId);
	if(isNumber(pageId)){
		if(info.isWindowClosing){
			control.updatePage({chromeId : null}, pageId);
		}
		else{
			control.removePage(pageId);
		}
	}
	processQueue.next();
}

function onTabUpdated(tabId, info, tab){
	var pageId = control.getPageId(tabId);
	if(isNumber(pageId)){
		control.updatePage(tab, pageId);
	}
	processQueue.next();
}

function onTabAttached(tabId, info){
	var groupId = control.getGroupId(info.newWindowId);
	if(isNumber(groupId)){
		var pageId = control.getPageId(tabId);
		control.attachPage(pageId, groupId, info.newPosition);
	}
	processQueue.next();
}

function onTabDetached(tabId, info){
	var groupId = control.getGroupId(info.oldWindowId);
	var pageId = control.getPageId(tabId);
	if(isNumber(groupId) && isNumber(pageId)){
		control.detachPage(pageId, groupId, info.oldPosition);
	}
	processQueue.next();
}

function onTabMoved(tabId, info){
	var groupId = control.getGroupId(info.windowId);
	var pageId = control.getPageId(tabId);
	if(isNumber(groupId) && isNumber(pageId)){
		control.movePage(pageId, groupId, info.fromIndex, info.toIndex);
	}
	processQueue.next();
}

chrome.windows.onCreated.addListener(processQueue.queue(onWindowCreated));
chrome.windows.onRemoved.addListener(processQueue.queue(onWindowRemoved));
chrome.tabs.onCreated.addListener(processQueue.queue(onTabCreated));
chrome.tabs.onRemoved.addListener(processQueue.queue(onTabRemoved));
chrome.tabs.onUpdated.addListener(processQueue.queue(onTabUpdated));
chrome.tabs.onAttached.addListener(processQueue.queue(onTabAttached));
chrome.tabs.onDetached.addListener(processQueue.queue(onTabDetached));
chrome.tabs.onMoved.addListener(processQueue.queue(onTabMoved));



 //  Message
////////////////////////////////////////////////////////////////////////////////
var messageHandler = {};
	messageHandler["open-window"] = function(groupId){
		var windowId = control.getWindowId(groupId);
		if(windowId == undefined){
			var url = control.getGroupUrl(groupId);
			chrome.windows.create({url : url, focused : true});
		}
		else{
			chrome.windows.update(windowId, {focused : true});
		}
	}
	
	messageHandler["rename-window"] = function(name, groupId){
		control.updateGroup({name : name}, groupId);
	}
	
	messageHandler["delete-window"] = function(groupId){
		var windowId = control.getWindowId(groupId);
		var index = control.getIndex(groupId);
			index.forEach(function(pageId){
				control.removePage(pageId);
			});
		control.removeGroup(groupId);
		if(windowId != undefined){
			chrome.windows.remove(windowId);
		}
	}

var messageBus = new MessageBus(messageHandler);

 //  Setup Browser Action
////////////////////////////////////////////////////////////////////////////////
function getGroups(callback){
	callback(windowManager.getGroups());
}

function openTab(tab){
	chrome.browserAction.getPopup({}, function(tab){
		chrome.tabs.create({url : "popup.html"});
		console.log(tab);
		if(!!tab){
		}
		else{
		}
	});
}
chrome.browserAction.onClicked.addListener(openTab);
chrome.browserAction.setPopup({popup : "popup.html"});
