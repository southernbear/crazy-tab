"use strict"

function Model(handler){
	var windowCreateHandler = handler.windowCreate;
	var windowRemoveHandler = handler.windowRemove;
	var windowUpdateHandler = handler.windowUpdate;

	var tabCreateHandler = handler.tabCreate;
	var tabRemoveHandler = handler.tabRemove;
	var tabUpdateHandler = handler.tabUpdate;
	
	var tabIndexHandler = handler.tabIndex;

	var mapWin = [];
	var mapTab = [];

	chrome.storage.local.get(null, function(storage){
		windows = [];
		tabs = [];
		tabIndexs = [];
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
				tabIndexs.every(function(db_tabIds, db_windowId){
					var ch_tabs = ch_window.tabs
					var match = false;
					if(ch_window.tabs.length == db_tabIds.length){
						match = db_tabIds.every(function(db_tabId, i){
							return ch_tabs[i].url == db_tabs[db_tabId].url;
						});
					}
					if(match){
						mapWin[ch_window.id] = db_windowId;
						function(var i = 0; i < ch_tabs.length; i++){
							mapTab[ch_tabs[i].id] = db_tabIds[i];
						};
					}
					else{
						
					}
					return !match;
				});
			});
		});
	});
}
