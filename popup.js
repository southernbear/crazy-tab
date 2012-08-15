"use strict"



 // Utils
////////////////////////////////////////////////////////////////////////////////
function $(id){
	return document.getElementById(id);
}

function $window(window){
	var id = typeof window == "number" ? window : window.id;
	return $("window-" + id);
}

function $tab(tab){
	var id = typeof tab == "number" ? tab : tab.id;
	return $("tab-" + id);
}

function $list(window){
	var id = typeof window == "number" ? window : window.id;
	return $("list-" + id);
}



 // Visual Elements
////////////////////////////////////////////////////////////////////////////////
function createTabElement(tab){
	var item = document.createElement("li");
		item.id = "tab-" + tab.id;
		var link = document.createElement("a");
			link.href = tab.url;
			link.textContent = tab.title;
			link.addEventListener("click", function(event){
				event.preventDefault();
				chrome.windows.update(tab.windowId, {focused : true});
				chrome.tabs.update(tab.id, {active : true});
				return false;
			});
			link.draggable = false;
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

function createWindowElement(window){
	var win = document.createElement("div");
		win.id = "win-" + window.id;
		var name = document.createElement("h1");
			name.textContent = window.name || "Window";
		var tabs = document.createElement("ul");
			tabs.id = "list-" + window.id;
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


 //  Handlers
////////////////////////////////////////////////////////////////////////////////
function createWindow(window){
	var win = createWindowElement(window);
	document.body.appendChild(win);
}

function removeWindow(window){
	var win = $window(window);
	win.parentNode.removeChild(win);
}

function updateWindow(window){
	var win = $window(window);
	//TODO
}

function createTab(tab){
	var item = createTabElement(tab);
	var list = $list(tab.windowId);
		$("detached").appendChild(item);
}

function removeTab(tab){
	var item = $tab(tab);
	item.parentNode.removeChild(item);
}

function updateTab(tab){
	var item = $tab(tab);
	var link = item.firstChild;
		link.href = tab.url;
		link.textContent = tab.title;
}

function attachTab(tab, index){
	var item = $tab(tab);
	var list = $list(tab.windowId);
	list.insertBefore(item, list.childNodes[windowId]);
}

function detachTab(tab){
	var item = $tab(tab);
	$("detached").appendChild(item);
}

function swapTab(tab1, tab2){
	var item1 = $tab(tab1);
	var item2 = $tab(tab2);
	item1.parentNode.insertBefore(item2, item1);
}


 //Init
////////////////////////////////////////////////////////////////////////////////


function init(){
	var handler = {
		windowCreate : createWindow,
		windowRemove : removeWindow,
		windowUpdate : updateWindow,
		tabCreate : createTab,
		tabRemove : removeTab,
		tabUpdate : updateTab,
		tabAttach : attachTab,
		tabDetach : detachTab,
		tabSwap : swapTab
	};
	var model = new Model(handler);
}

window.addEventListener("load", init);
