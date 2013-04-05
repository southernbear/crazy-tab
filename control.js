"use strict"


function Control(){
 // Variables
////////////////////////////////////////////////////////////////////////////////
	
	//Cache
	var GROUPS  = [];
	var INDEXES = [];
	var PAGES   = [];
	
	//Map
	var mapWin = [];
	var mapPage = [];
	
	//
	var execQueue = [];
	
	var messageBus = new MessageBus();
	
	var sync = new Sync();


 // Classes
////////////////////////////////////////////////////////////////////////////////
	function Group(window, _groupId, _chromeId){
		var groupId  = parseInt(_groupId);
		var chromeId = parseInt(_chromeId);
	
		if(isNaN(groupId)) throw "Invalid id :" + _groupId;
		this.groupId  = groupId;
		this.chromeId = isNaN(chromeId) ? undefined : chromeId;
		this.name     = window.name || "Window " + groupId;
		
		this.update   = function(info){
			for(var property in info){
				if(property in this){
					if(property == "chromeId"){
						delete mapWin[this[property]];
						mapWin[info[property]] = groupId;
					}
					this[property] = info[property];
				}
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
				if(property in this){
					if(property == "chromeId"){
						delete mapPage[this[property]];
						mapPage[info[property]] = pageId;
					}
					this[property] = info[property];
				}
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
		sync.set(object);
	}
	
	function load(key, callback){
		chrome.storage.local.get(key, callback);
	}
	
	function remove(key){
		sync.remove(key);
	}
	
	function clear(){
		chrome.storage.load.clear();
	}
	

/*
 * Storage keys
 */

var KEY = {
	group : function(groupId){ return "group:" + groupId; },
	index : function(groupId){ return "index:" + groupId; },
	page  : function(pageId) { return "page:"  + pageId; }
}


 // Control
////////////////////////////////////////////////////////////////////////////////
	function createGroup(info, chromeId){
		var groupId = getNewGroupId();
		var group = new Group(info, groupId, chromeId);
	
		save(KEY.group(groupId), group);
		save(KEY.index(groupId), []);
		
		messageBus.send("group-create", group);
	}

	function removeGroup(groupId){
		delete mapWin[GROUPS[groupId].chromeId];
		delete GROUPS[groupId];
		delete INDEXES[groupId];
		remove(KEY.group(groupId));
		remove(KEY.index(groupId));
		
		messageBus.send("group-remove", groupId);
	}
	
	function updateGroup(info, groupId){
		GROUPS[groupId].update(info);
		save(KEY.group(groupId), GROUPS[groupId]);
		
		messageBus.send("group-update", GROUPS[groupId]);
	}
	
	function createPage(info, groupId, chromeId){
		var pageId = getNewPageId();
		var page = new Page(info, pageId, groupId, chromeId);
		var index = info >= 0 ? info.index : INDEXES[groupId].length;
		INDEXES[groupId].splice(info.index, 0, pageId);
		save(KEY.page(pageId), page);
		save(KEY.index(groupId), INDEXES[groupId]);
		
		messageBus.send("page-create", page);
	}
	
	function removePage(pageId){
		var groupId = PAGES[pageId].groupId;
		var index = INDEXES[groupId];
			index.splice(index.indexOf(pageId), 1);
		delete mapPage[PAGES[pageId].chromeId];
		delete PAGES[pageId];
		save(KEY.index(groupId), index);
		remove(KEY.page(pageId));
		
		messageBus.send("page-remove", pageId);
	}
	
	function updatePage(info, pageId){
		PAGES[pageId].update(info);
		save(KEY.page(pageId), PAGES[pageId]);
		
		messageBus.send("page-update", PAGES[pageId]);
	}

	function attachPage(pageId, groupId, index){
		if (PAGES[pageId].groupId != null) {
			detachPage(pageId);
		}
		if (!(index >= 0)) {
			index = INDEXES[groupId].length;
		}
		PAGES[pageId].groupId = parseInt(groupId);
		INDEXES[groupId].splice(index, 0, pageId);
		save(KEY.page(pageId), PAGES[pageId]);
		save(KEY.index(groupId), INDEXES[groupId]);
		
		messageBus.send("page-attach", pageId, groupId, index);
	}
	
	function detachPage(pageId){
		var groupId = PAGES[pageId].groupId;
		var index = INDEXES[groupId].indexOf(pageId);
		delete PAGES[pageId].groupId;
		INDEXES[groupId].splice(index, 1);
		save(KEY.page(pageId), PAGES[pageId]);
		save(KEY.index(groupId), INDEXES[groupId]);
		
		messageBus.send("page-detach", pageId);
	}
	
	function movePage(pageId, groupId, from, to){
		var index = INDEXES[groupId];
			index.splice(from, 1);
			index.splice(to, 0, pageId);
		save(KEY.index(groupId), index);
		
		messageBus.send("page-move", pageId, groupId, to);
	}
	
	function getGroupId(id){
		return mapWin[id];
	}
	
	function getGroupUrl(groupId){
		var out;
		var index = INDEXES[groupId];
		if(index){
			out = [];
			var len = index.length;
			for(var i in index){
				out[i] = PAGES[index[i]].url;
			}
		}
		return out;
	}
	
	function getPageId(id){
		return mapPage[id];
	}
	
	function getPageUrl(pageId){
		return PAGES[pageId].url;
	}
	
	function getWindowId(id){
		return GROUPS[id].chromeId;
	}
	
	function getTabId(id){
		return PAGES[id].chromeId;
	}
	
	function getIndex(groupId){
		var out;
		var index = INDEXES[groupId];
		if(index){
			out = [];
			var len = index.length;
			for(var i in index){
				out[i] = index[i];
			}
		}
		return out;
	}
	
	function findGroupId(window){
		if(window == undefined)
			return null;
	
		if(mapWin[window.id] != undefined)
			return mapWin[window.id];
	
		if(window.type != "normal")
			return null;
			
		var tabs = window.tabs;
		if(window.tabs == undefined)
			return null;
			
		var match = false;
		for(var groupId in INDEXES){
			if(GROUPS[groupId].chromeId != undefined)
				continue;
			
			var index = INDEXES[groupId];
			if(tabs.length == index.length){
				match = index.every(function(pageId, i){
					return tabs[i].url == PAGES[pageId].url;
				});
			}
			if(match)
				return groupId;
		}
		return null;
	}
	
	function getGroups(){
		return GROUPS;
	}
	
	function getPage(pageId){
		return PAGES[pageId];
	}
	
	this.getGroups   = getGroups;
	this.getPage     = getPage;
	this.getGroupId	 = getGroupId;
	this.getGroupUrl = getGroupUrl;
	this.getPageId   = getPageId;
	this.getWindowId = getWindowId;
	this.getTabId    = getTabId;
	this.getIndex	 = getIndex;
	this.findGroupId = findGroupId;
	this.createGroup = createGroup;
	this.removeGroup = removeGroup;
	this.updateGroup = updateGroup;
	this.createPage  = createPage;
	this.removePage  = removePage;
	this.updatePage  = updatePage;
	this.attachPage  = attachPage;
	this.detachPage  = detachPage;
	this.movePage    = movePage;

 // Load Database Functions
////////////////////////////////////////////////////////////////////////////////
	function saveNewGroup(window){
		var groupId = getNewGroupId();
		var group = new Group(window, groupId, window.id);
		
		var index = [];
		window.tabs.forEach(function(tab){
			var pageId = getNewPageId();
			var page = new Page(tab, pageId, groupId, tab.id);
			PAGES[pageId] = page;
			index.push(pageId);
		});
		
		INDEXES[groupId] = index;
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
			if(!match){
				saveNewGroup(window);
			}
		});
		
		//Refresh database
		var data = {};
		GROUPS.forEach(function(group){
			data[KEY.group(group.groupId)] = group;
		});
		PAGES.forEach(function(page){
			data[KEY.page(page.pageId)] = page;
		});
		INDEXES.forEach(function(index, i){
			data[KEY.index(i)] = index;
		});
		sync.set(data);
		
		
		execQueue.shift()();	
	}
	
	function loadDatabase (storage){
		for(key in storage){
			var matches = key.match(/^(group):(\d+)/);
			if(matches){
				var group = new Group(storage[key], matches[2]);
			}
		}
		for(key in storage){
			var matches = key.match(/^(page):(\d+)/);
			if(matches){
				var page = new Page(storage[key], matches[2], storage[key].groupId);
			}
		}
		for(key in storage){
			var matches = key.match(/^(index):(\d+)/);
			if(matches){
				INDEXES[matches[2]] = storage[key];
			}
		}
		
		validate();
		
		execQueue.shift()();
	}
	
	function syncDatabase(local){
		chrome.storage.sync.get(function(sync){
			var lastSyncOnline = sync.lastSync || 0;
			var lastSyncLocal  = local.lastSync || 0;
		
			if (lastSyncOnline > lastSyncLocal) {
				chrome.storage.local.clear();
				chrome.storage.local.set(sync);
			}
			else if (lastSyncOnline < lastSyncLocal) {
				chrome.storage.sync.clear();
				chrome.storage.sync.set(local);
			}
		
			execQueue.shift()();
		});
	}
	
	function validate(){
		/* Validate index */
		INDEXES.forEach(function(list, groupId){
			list.forEach(function(pageId, index){
				if (!(pageId in PAGES)) {
					console.error('Page ' + pageId + ' does not exist, delete it');
					delete list[index];
					save(KEY.index(groupId), list);
				}
			});
		});
	}


 //Init
////////////////////////////////////////////////////////////////////////////////
	execQueue.push(function(){load(null, syncDatabase)});
	execQueue.push(function(){load(null, loadDatabase)});
	execQueue.push(function(){chrome.windows.getAll({populate : true}, mapChromeWindows)});
	execQueue.push(function(){});
	
	execQueue.shift()();
}
