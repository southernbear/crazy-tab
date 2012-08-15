"use strict"

function Model(handler, isController){
	var windowCreateHandler = handler.windowCreate;
	var windowRemoveHandler = handler.windowRemove;
	var windowUpdateHandler = handler.windowUpdate;

	var tabCreateHandler = handler.tabCreate;
	var tabRemoveHandler = handler.tabRemove;
	var tabUpdateHandler = handler.tabUpdate;
	
	var tabAttachHandler = handler.tabAttach;
	var tabDetachHandler = handler.tabDetach;
	var tabSwapHandler = handler.tabSwap;

	var windows = [];
	var tabs = [];
	var tabIndexs = [];
	
	var mapWin = [];
	var mapTab = [];
	
	
	function Window(window, id){
		if(!id) throw "Invalid id :" + id;
		Object.defindProperty(this, "id", {value : id, writable : false});
		return this;
	}
	
	function Tab(tab, tabId, windowId){
		if(!tabId) throw "Invalid id :" + tabId;
		Object.defindProperty(this, "id", {value : tabId, writable : false});
		this.url      = tab.url;
		this.title    = tab.title;
		this.pinned   = tab.pinned;
		this.windowId = windowId;
		return this;		
	}
	
	var getNewWindowId = (function(){
		var id = 0;
		return function(){
			for(; windows[id] !== undefined ; id++);
			return id;
		}
	})();
	
	var getNewTabId = (function(){
		var id = 0;
		return function(){
			for(; tabs[id] !== undefined ; id++);
			return id;
		}
	})();
	
	function save(object){
		chrome.storage.local.set(object);
	}
	
	chrome.storage.onChange.addListener(function(changes, namespace){
		for(key in changes){
			matches = key.match(/(window|tab|window-tab):(\d+)/);
			if(matches){
				change = changes[key];
				oldValue = change.oldValue;
				newValue = change.newValue;
				action = newValue ? (oldValue ? "update" : "create") : "remove";
				switch(matches[1]){
				case "window" :
					switch(action){
					case "create" :
						handler.windowCreate(newValue);
						break;
					case "remove" :
						handler.windowRemove(oldValue);
						break;
					case "update" :
						handler.windowUpdate(newValue);
						break;
					}
					break;
				case "tab" :
					switch(action){
					case "create" :
						handler.tabCreate(newValue);
						break;
					case "remove" :
						handler.tabRemove(oldValue);
						break;
					case "update" :
						handler.tabUpdate(newValue);
						break;
					}
					break;
				case "window-tab" :
					switch(action){
					case "update" :
						//assume only one change
						var len = min(oldValue.length, newValue.length)
						var pos = 0;
						for(pos; pos < len; pos++){
							if(oldValue[pos] != newValue[pos])
								break;
						}
						var rshift = oldValue[pos] == newValue[pos+1];
						var lshift = newValue[pos] == oldValue[pos+1];
						if(rshift && !lshift){
							//Attach
							handler.tabAttach(newValue[pos], pos);
						}
						else if(!rshift && lshift){
							//Detach
							handler.tabAttach(oldValue[pos], pos);
						}
						else if(rshift && lshift){
							//Swap
							handler.tabSwap(oldValue[pos], newValue[pos], pos);
						}
						break;
					default :
						break;
					}
					break;
				}
			}
		}
	}

	chrome.storage.local.get(null, function(storage){
		for(key in storage){
			matches = key.match(/(window|tab|window-tab):(\d+)/);
			if(matches){
				switch(matches[1]){
				case "window" :
					windows[matches[2]] = storage[key];
					handler.windowCreate(storage[key]);
				case "tab" :
					tabs[matches[2]] = storage[key];
				case "window-tab" :
					tabIndexs[matches[2]] = storage[key];
					tabIndexs[matches[2]].forEach(tabId){
						handler.tabCreate(tabs[tabId], windowId);
					}
				}
			}
		}
		
		//map chrome windows to database windows
		chrome.windows.getAll({populate : true}, function(ch_windows){
			//rename
			var db_tabs = tabs;
			
			//ch = chrome, db = database
			ch_windows.forEach(function(ch_window, no){
				var match = false;
				for(db_windowId in tabIndexs){
					if(!match){
						var db_tabIds = tabIndexs[db_windowId];
						var ch_tabs = ch_window.tabs
						if(ch_window.tabs.length == db_tabIds.length){
							match = db_tabIds.every(function(db_tabId, i){
								return ch_tabs[i].url == db_tabs[db_tabId].url;
							});
						}
					}
				}
				if(match){
					mapWin[ch_window.id] = db_windowId;
					function(var i = 0; i < ch_tabs.length; i++){
						mapTab[ch_tabs[i].id] = db_tabIds[i];
					};
					break;
				}
				else if(isController){
					var db_windowId = getNewWindowId();
					db_window = new Window(ch_window, db_windowId);
					mapWin[ch_window] = db_windowId;
					save({"window:" + db_windowId : db_window});
					
					db_tabs = []
					ch_window.tabs.forEach(function(ch_tab){
						var db_tabId = getNewTabId();
						db_tab = new Tab(ch_tab, ch_tabId, db_windowId);
						mapTab[ch_tabId] = db_tabId;
						save({"tab:" + db_windowId : db_window});
						db_tabs.push(db_tabId);
					});
					
					save({"window-tab:" + db_windowId : db_tabs});
				}
			});
		});
	});
}
