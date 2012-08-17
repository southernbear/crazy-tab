"use strict"


function Model(handler, isController){
 // Variables
////////////////////////////////////////////////////////////////////////////////
	var eventTypes = [
		"group-create",
		"group-remove",
		"group-update",
		
		"page-create",
		"page-remove",
		"page-update",
		
		"page-attach",
		"page-detach",
		"page-move"
	];
	
	var handler = handler instanceof Object ? handler : {};
	eventTypes.forEach(function(eventType){
		if(!(eventType in handler))
			handler[eventType] = function(){};
	});

	var GROUPS  = [];
	var INDEXES = [];
	var PAGES   = [];
	
	var mapWin = [];
	var mapPage = [];
	
	var execQueue = [];


 // Classes
////////////////////////////////////////////////////////////////////////////////
	function Group(window, _groupId, _chromeId){
		var groupId  = parseInt(_groupId);
		var chromeId = parseInt(_chromeId);
	
		if(isNaN(groupId)) throw "Invalid id :" + _groupId;
		this.groupId  = groupId;
		this.chromeId = isNaN(chromeId) ? undefined : chromeId;
		this.update   = function(info){
			for(property in info){
				if(property in this)
					this[property] = info[property];
			}
		}
		GROUPS[groupId]  = this;
		INDEXES[groupId] = INDEXES[groupId] || [];
		mapWin[chromeId] = groupId;
		return this;
	}
	
	function Page(tab, _pageId, _groupId, _chromeId){
		var pageId 	 = parseInt(_pageId);
		var groupId  = parseInt(_groupId);
		var chromeId = parseInt(_chromeId);
		
		if(isNaN(pageId)) throw "Invalid id :" + _pageId;
		this.pageId   = pageId;
		this.url      = tab.url;
		this.title    = tab.title;
		this.pinned   = tab.pinned;
		this.groupId  = isNaN(groupId)  ? undefined : groupId;
		this.chromeId = isNaN(chromeId) ? undefined : chromeId;
		this.update   = function(info){
			for(var property in info){
				if(property in this)
					this[property] = info[property];
			}
		}
		PAGES[pageId] = this;
		mapPage[chromeId] = pageId;
		return this;		
	}
	


 // Utils
////////////////////////////////////////////////////////////////////////////////
	var getNewGroupId = (function(){
		var id = 0;
		return function(){
			for(; GROUPS[id] !== undefined ; id++);
			return id;
		}
	})();
	
	var getNewPageId = (function(){
		var id = 0;
		return function(){
			for(; PAGES[id] !== undefined ; id++);
			return id;
		}
	})();
	
	function save(key, item){
		var object = {};
			object[key] = item;
		chrome.storage.local.set(object);
	}
	
	function load(key, callback){
		chrome.storage.local.get(key, callback);
	}
	
	function remove(key){
		chrome.storage.local.remove(key);
	}
	
	function clear(){
		chrome.storage.local.clear();
	}
	

 // Model Event
////////////////////////////////////////////////////////////////////////////////
	function getMoveInfo(oldValue, newValue){
		//assume only one change
		if(oldValue.length == newValue.length){
			//move
			var len = oldValue.length;
			var pos = 0;
			for(pos; pos < len; pos++){
				if(oldValue[pos] != newValue[pos])
					break;
			}
			if(oldValue[pos] == newValue[pos+1]){
				//left move
				var id = newValue[pos];
				var to = pos;
				for(; pos < len && oldValue[pos] != id; pos++);
				return {tabId : id, from : pos, to : to};
			}
			else if(newValue[pos] == oldValue[pos+1]){
				//right move
				var id = oldValue[pos];
				var from = pos;
				for(; pos < len && newValue[pos] != id; pos++);
				return {tabId : id, from : from, to : pos};
			}
			else{
				console.error([oldValue, newValue]);
			}
		}
		else{
			//insert or remove
			var len = Math.min(oldValue.length, newValue.length)
			var pos = 0;
			for(pos; pos < len; pos++){
				if(oldValue[pos] != newValue[pos])
					break;
			}
			if(oldValue[pos] == newValue[pos+1]){
				//insert
				return {tabId : newValue[pos], to : pos};
			}
			else if(newValue[pos] == oldValue[pos+1]){
				//Detach
				return {tabId : oldValue[pos]};
			}
			else{
				console.error([oldValue, newValue]);
			}
		}
	}
	
	function groupEventHandler(event, groupId, oldValue, newValue){
		switch(event){
		case "create" :
			var val = newValue;
			handler["group-create"](new Group(val, groupId, val.chromeId));
			break;
		case "remove" :
			delete GROUPS[oldValue.groupId];
			delete INDEXES[oldValue.groupId];
			delete mapWin[oldValue.chromeId];
			handler["group-remove"](oldValue);
			break;
		case "update" :
			var val = newValue;
			handler["group-update"](new Group(val, groupId, val.chromeId));
			break;
		}
	}
	
	function pageEventHandler(event, pageId, oldValue, newValue){
		switch(event){
		case "create" :
			var val = newValue;
			handler["page-create"](new Page(val, pageId, val.groupId, val.chromeId));
			break;
		case "remove" :
			delete PAGES[oldValue.pageId];
			delete mapPage[oldValue.chromeId];
			handler["page-remove"](oldValue);
			break;
		case "update" :
			var val = newValue;
			handler["page-update"](new Page(val, pageId, val.groupId, val.chromeId));
			break;
		}
	}
	
	function indexEventHandler(event, groupId, oldValue, newValue){
		switch(event){
		case "create" :
			INDEXES[groupId] = newValue;
			newValue.forEach(function(pageId, index){
				handler["page-attach"](pageId, groupId, index);
			});
			break;
		case "remove" :
			delete INDEXES[groupId];
			oldValue.forEach(function(pageId, index){
				handler["page-detach"](pageId, groupId, index);
			});
			break;
		case "update" :
			INDEXES[groupId] = newValue;
			var info = getMoveInfo(oldValue, newValue);
			if(info.to){
				if(info.from){
					handler["page-move"](info.tabId, groupId, info.from, info.to);
				}
				else{
					handler["page-attach"](info.tabId, groupId, info.to);
				}
			}
			else{
				handler["page-detach"](info.tabId, groupId, info.from);
			}
		}
	}
	
	function modelEventHandler(changes, namespace){
		for(key in changes){
			var matches = key.match(/(group|page|index):(\d+)/);
			if(matches){
				var oldValue = changes[key].oldValue;
				var newValue = changes[key].newValue;
				var action = newValue ? (oldValue ? "update" : "create") : "remove";
				switch(matches[1]){
				case "group" :
					groupEventHandler(action, matches[2], oldValue, newValue);
					break;
				case "page" :
					pageEventHandler(action, matches[2], oldValue, newValue);
					break;
				case "index" :
					indexEventHandler(action, matches[2], oldValue, newValue);
					break;
				}
			}
		}
	}


 // Control
////////////////////////////////////////////////////////////////////////////////
	function createGroup(info, chromeId){
		var groupId = getNewGroupId();
		var group = new Group(info, groupId, chromeId);
	
		save("group:" + groupId, group);
		save("index:" + groupId, []);
	}

	function removeGroup(groupId){
		remove("group:" + groupId);
		remove("index:" + groupId);
	}
	
	function createPage(info, groupId, chromeId){
		var pageId = getNewPageId();
		var page = new Page(info, pageId, groupId, chromeId);
		save("page:" + pageId, page);
		
		INDEXES[groupId].splice(info.index, 0, pageId);
		save("index:" + groupId, INDEXES[groupId]);
	}
	
	function removePage(pageId){
		var groupId = PAGES[pageId].groupId;
		var index = INDEXES[groupId];
			index.splice(index.indexOf(pageId), 1);
		save("index:" + groupId, index);
		remove("page:" + pageId);
	}
	
	function updatePage(info, pageId){
		PAGES[pageId].update(info);
		save("page:" + pageId, PAGES[pageId]);
	}

	function attachPage(pageId, groupId, index){
		PAGES[pageId].groupId = parseInt(groupId);
		save("page:" + pageId, PAGES[pageId]);

		INDEXES[groupId].splice(index, 0, pageId);
		save("index:" + groupId, INDEXES[groupId]);
	}
	
	function detachPage(pageId, groupId, index){
		delete PAGES[pageId].groupId;
		save("page:" + pageId, PAGES[pageId]);

		INDEXES[groupId].splice(index, 1);
		save("index:" + groupId, INDEXES[groupId]);
	}
	
	function movePage(pageId, groupId, from, to){
		var index = INDEXES[groupId];
			index.splice(from, 1);
			index.splice(to, 0, pageId);
		save("index:" + groupId, index);
	}

	this.getControl = function (){
		return !isController ? null : {
			getGroupId : function(id){
				return mapWin[id];
			},
			getPageId : function(id){
				return mapPage[id];
			},
			getWindowId : function(id){
				return GROUPS[id].chromeId;
			},
			getTabId : function(id){
				return PAGES[id].chromeId;
			},
			createGroup : createGroup,
			removeGroup : removeGroup,
			createPage  : createPage,
			removePage  : removePage,
			updatePage  : updatePage,
			attachPage  : attachPage,
			detachPage  : detachPage,
			movePage    : movePage
		}
	}

 // Load Database Functions
////////////////////////////////////////////////////////////////////////////////
	function saveNewGroup(window){
		var groupId = getNewGroupId();
		var group = new Group(window, groupId, window.id);
		save("group:" + groupId, group);
		
		var index = [];
		window.tabs.forEach(function(tab){
			var pageId = getNewPageId();
			var page = new Page(tab, pageId, groupId, tab.id);
			save("page:" + pageId, page);
			PAGES[pageId] = page;
			index.push(pageId);
		});
		
		INDEXES[groupId] = index;
		save("index:" + groupId, index);
	}
	
	//map chrome windows to database windows
	function mapChromeWindows(windows){
		windows.forEach(function(window){
			if(window.type != "normal")
				return;
			var match = false;
			for(var groupId in INDEXES){
				if(!match){
					var index = INDEXES[groupId];
					var tabs = window.tabs;
					if(tabs.length == index.length){
						match = index.every(function(pageId, i){
							return tabs[i].url == PAGES[pageId].url;
						});
					}
					if(match){
						mapWin[window.id] = groupId;
						GROUPS[groupId].chromeId = window.id;
						for(var i = 0; i < tabs.length; i++){
							mapPage[tabs[i].id] = index[i];
							PAGES[index[i]].chromeId = tabs[i].id;
						};
					}
				}
			}
			if(!match && !!isController){
				saveNewGroup(window);
			}
		});
		execQueue.shift()();	
	}
	
	function loadDatabase (storage){
		for(key in storage){
			var matches = key.match(/^(group):(\d+)/);
			if(matches){
				var group = new Group(storage[key], matches[2]);
				handler["group-create"](group);
			}
		}
		for(key in storage){
			var matches = key.match(/^(page):(\d+)/);
			if(matches){
				var page = new Page(storage[key], matches[2], storage[key].groupId);
				handler["page-create"](page);
			}
		}
		for(key in storage){
			var matches = key.match(/^(index):(\d+)/);
			if(matches){
				INDEXES[matches[2]] = storage[key];
				INDEXES[matches[2]].forEach(function(pageId, index){
					handler["page-attach"](PAGES[pageId], matches[2], index);
				});
			}
		}
		execQueue.shift()();
	}
	



 //Init
////////////////////////////////////////////////////////////////////////////////
	execQueue.push(function(){load(null, loadDatabase)});
	execQueue.push(function(){chrome.windows.getAll({populate : true}, mapChromeWindows)});
	execQueue.push(function(){chrome.storage.onChanged.addListener(modelEventHandler)});
	
	execQueue.shift()();
}
