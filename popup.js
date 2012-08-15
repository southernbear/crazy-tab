"use strict"



 // Utils
////////////////////////////////////////////////////////////////////////////////
function $(id){
	return document.getElementById(id);
}

function nthWin(n){
	var win = $("container").childNodes[n];
	if(win)
		win.nthTab = function(n){
			if(!win.firstChild)
				console.log(win);
			return win.getElementsByTagName("li")[n];
		}
	return win;
}


 //  Setup Listener
////////////////////////////////////////////////////////////////////////////////
function createWindow(winIndex, window){
	var win = createGroupElement(window);
	document.body.appendChild(win);
}

function removeWindow(winIndex){
	var win = document.body.childNodes[winIndex];
	win.parentNode.removeChild(win);
}

function insertTab(winIndex, tabIndex, tab){
	var tab = createTabElement(tab);
	var list = nthWin(winIndex).getElementsByTagName("ul")[0];
		list.insertBefore(tab, list.childNodes[tabIndex]);
}

function removeTab(winIndex, tabIndex){
	var item = nthWin(winIndex).nthTab(tabIndex);
	item.parentNode.removeChild(item);
}

function moveTab(winIndex, oldIndex, newIndex){
	var list = nthWin(winIndex).getElementsByTagName("ul")[0];
	var item = list.childNodes[oldIndex];
	list.removeChild(item);
	list.insertBefore(item, list.childNodes[newIndex]);
}

function updateTab(winIndex, tabIndex, tab){
	var item = nthWin(winIndex).nthTab(tabIndex);
	var link = item.firstChild;
		link.href = tab.url;
		link.textContent = tab.title;
}

var manager = (function(){
	var listeners = [];
	chrome.extension.onMessage.addListener(function(message){
		var eventType = message.eventType;
		var args = chrome.extension.getBackgroundPage().windowManager.args;
		listeners.forEach(function(listener){
			if(listener.type == eventType){
				listener.callback.apply(null, args);
			}
		});
	});
	
	function addEventListener(eventType, callback){
		if(eventType && callback){
			listeners.push({type : eventType, callback : callback});
		}
	}
	
	function removeEventListener(type, callback){
		listeners.every(function(listener, no){
			if(listener.type == type && listener.callback == callback){
				delete listeners[no];
				return false;
			}
			return true;
		});
	}
	
	var that = {
		addEventListener : addEventListener,
		removeEventListener : removeEventListener
	}
	return that;
})();
	
function addListeners(){
	manager.addEventListener("create window", createWindow);
	manager.addEventListener("remove window", removeWindow);
	manager.addEventListener("insert tab", insertTab);
	manager.addEventListener("remove tab", removeTab);
	manager.addEventListener("move tab", moveTab);
	manager.addEventListener("update tab", updateTab);
}

function removeListeners(){
	manager.removeEventListener("create window", createWindow);
	manager.removeEventListener("remove window", removeWindow);
	manager.removeEventListener("insert tab", insertTab);
	manager.removeEventListener("remove tab", removeTab);
	manager.removeEventListener("move tab", moveTab);
	manager.removeEventListener("update tab", updateTab);
}


 //Init
////////////////////////////////////////////////////////////////////////////////
function createTabElement(tab){
	var item = document.createElement("li");
		if (tab.id)
			item.id = "Tab#" + tab.id;
		var link = document.createElement("a");
			link.href = tab.url;
			link.textContent = tab.title;
			link.addEventListener("click", function(event){
				event.preventDefault();
				chrome.windows.update(tab.windowId, {focused : true});
				chrome.tabs.update(tab.id, {active : true});
				return false;
			});
			link.draggable = true;
			link.addEventListener("dragstart", function(event){
				transfer = event.dataTransfer;
				transfer.effectAllow = "move";
				transfer.setData("text/x-tab", JSON.stringify(tab));
				transfer.setDragImage(item, 0, 0);
			}, false);
			link.addEventListener("dragend", function(event){
				if(event.dataTransfer.dropEffect == "move"){
					item.parentNode.removeChild(item);
				}
			}, false);
		item.appendChild(link);
	return item;
}

function createGroupElement(window){
	var win = document.createElement("div");
		if (window.id)
			win.id = "Win#" + window.id;
		var name = document.createElement("h1");
			name.textContent = window.name || "Window";
		var tabs = document.createElement("ul");
			if(window.tabs){
				window.tabs.forEach(function(tab, no){
					var item = createTabElement(tab);
					tabs.appendChild(item);
				});
			}
		win.addEventListener("dragover", function(event){
			event.preventDefault();
		}, true);
		win.addEventListener("dragleave", function(event){
		}, true);
		win.addEventListener("drop", function(event){
			transfer = event.dataTransfer;
			var tab = JSON.parse(transfer.getData("text/x-tab"));
			chrome.tabs.move(tab.id, {windowId : window.id, index : -1});
			var item = createTabItem(tab);
			tabs.appendChild(item);
		}, true);
		win.appendChild(name);
		win.appendChild(tabs);
	return win;
}

function createWindowsView(windows){
	var container = document.createElement("div");
		container.id = "container";
	windows.forEach(function(window){
		var win = createGroupElement(window);
		container.appendChild(win);
	});
	document.body.appendChild(container);
}


function init(){
	
}

window.addEventListener("unload", final);
window.addEventListener("load", init);
