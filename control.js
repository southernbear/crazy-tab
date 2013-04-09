"use strict"


function Control(){
 // Variables
////////////////////////////////////////////////////////////////////////////////
	
	//Cache
	var GROUPS  = [];
	var PAGES   = [];
	var INDEXES = function(groupId){return GROUPS[groupId].pages;}
	
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
		this.pages    = [];
		
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

		this.getInfo  = function(){
			return {
				name : this.name,
			};
		}

		GROUPS[groupId]  = this;
		mapWin[chromeId] = groupId;
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

		this.getInfo  = function(){
			return {
				url	   : this.url,
				title  : this.title,
				pinned : this.pinned
			};
		}

		PAGES[pageId] = this;
		mapPage[chromeId] = pageId;
	}
	


 // Utils
////////////////////////////////////////////////////////////////////////////////
	var getNewGroupId = (function(){
		var id = 1;
		return function(){
			for(; GROUPS[id] != null ; id++);
			return id;
		}
	})();
	
	var getNewPageId = (function(){
		var id = 1;
		return function(){
			for(; PAGES[id] != null ; id++);
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

	function saveGroup(groupId) {
		save(KEY.group(groupId), GROUPS[groupId].getInfo());
	}

	function saveIndex(groupId) {
		save(KEY.index(groupId), getIndex(groupId));
	}

	function savePage(pageId) {
		save(KEY.page(pageId), PAGES[pageId].getInfo());
	}


 // Control
////////////////////////////////////////////////////////////////////////////////
	function createGroup(info, chromeId){
		var groupId = getNewGroupId();
		var group = new Group(info, groupId, chromeId);
	
		saveGroup(groupId);
		saveIndex(groupId);
		
		messageBus.send("group-create", group);
	}

	function removeGroup(groupId){
		delete mapWin[GROUPS[groupId].chromeId];
		delete GROUPS[groupId];
		remove(KEY.group(groupId));
		remove(KEY.index(groupId));
		
		messageBus.send("group-remove", groupId);
	}
	
	function updateGroup(info, groupId){
		GROUPS[groupId].update(info);
		saveGroup(groupId);
		
		messageBus.send("group-update", GROUPS[groupId]);
	}
	
	function createPage(info, groupId, chromeId){
		var pageId = getNewPageId();
		var page = new Page(info, pageId, groupId, chromeId);
		var index = info.index >= 0 ? info.index : INDEXES(groupId).length;
		INDEXES(groupId).splice(index, 0, page);
		savePage(pageId);
		saveIndex(groupId);
		
		messageBus.send("page-create", page);
	}
	
	function removePage(pageId){
		var page = PAGES[pageId];
		var groupId = page.groupId;
		var index = INDEXES(groupId);
		    index.splice(index.indexOf(page), 1);
		delete mapPage[page.chromeId];
		delete PAGES[pageId];
		saveIndex(groupId);
		remove(KEY.page(pageId));
		
		messageBus.send("page-remove", pageId);
	}
	
	function updatePage(info, pageId){
		PAGES[pageId].update(info);
		savePage(pageId);
		
		messageBus.send("page-update", PAGES[pageId]);
	}

	function attachPage(pageId, groupId, index){
		var page = PAGES[pageId];
		if (page.groupId != null) {
			detachPage(pageId);
		}
		if (!(index >= 0)) {
			index = INDEXES(groupId).length;
		}
		PAGES[pageId].groupId = parseInt(groupId);
		INDEXES(groupId).splice(index, 0, page);
		savePage(pageId);
		saveIndex(groupId);
		
		messageBus.send("page-attach", pageId, groupId, index);
	}
	
	function detachPage(pageId){
		var page = PAGES[pageId];
		var groupId = page.groupId;
		var index = INDEXES(groupId).indexOf(page);
		delete page.groupId;
		INDEXES(groupId).splice(index, 1);
		savePage(pageId);
		saveIndex(groupId);
		
		messageBus.send("page-detach", pageId);
	}
	
	function movePage(pageId, groupId, from, to){
		var index = INDEXES(groupId);
		    index.splice(index.indexOf(PAGES[pageId]), 1);
		    index.splice(to, 0, PAGES[pageId]);
		saveIndex(groupId);
		
		messageBus.send("page-move", pageId, groupId, to);
	}
	
	function getGroupId(id){
		return mapWin[id];
	}
	
	function getGroupUrl(groupId){
		var out;
		var index = INDEXES(groupId);
		if(index){
			out = [];
			index.forEach(function(page, i){
				out[i] = page.url;
			});
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
		var index = INDEXES(groupId);
		if(index){
			out = [];
			index.forEach(function(page, i){
				out[i] = page.pageId;
			});
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
		for(var groupId in GROUPS){
			if(GROUPS[groupId].chromeId != undefined)
				continue;
			
			var index = INDEXES(groupId);
			if(tabs.length == index.length){
				match = index.every(function(page, i){
					return tabs[i].url == PAGES[page.pageId].url;
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
		if (window.type != 'normal')
			return;

		var groupId = getNewGroupId();
		var group = new Group(window, groupId, window.id);
		
		var index = [];
		window.tabs.forEach(function(tab){
			var pageId = getNewPageId();
			var page = new Page(tab, pageId, groupId, tab.id);
			PAGES[pageId] = page;
			index.push(page);
		});
		
		group.pages = index;
	}
	
	//map chrome windows to database windows
	function mapChromeWindows(windows){
		windows.forEach(function(window){
			var groupId = findGroupId(window);
			if(groupId != null){
				mapWin[window.id] = groupId;
				GROUPS[groupId].chromeId = window.id;

				var index = INDEXES(groupId);
				var tabs = window.tabs;
				for(var i = 0; i < tabs.length; i++){
					mapPage[tabs[i].id] = index[i].pageId;
					index[i].chromeId = tabs[i].id;
				};
			}
			else {
				saveNewGroup(window);
			}
		});
		
		//Refresh database
		var data = {};
		GROUPS.forEach(function(group, groupId){
			data[KEY.group(groupId)] = group.getInfo();
			data[KEY.index(groupId)] = getIndex(groupId);
		});
		PAGES.forEach(function(page){
			data[KEY.page(page.pageId)] = page.getInfo();
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
				var page = new Page(storage[key], matches[2]);
			}
		}
		for(key in storage){
			var matches = key.match(/^(index):(\d+)/);
			if(matches){
				var idList = storage[key];
				var index = INDEXES(matches[2]);
				idList.forEach(function(pageId, i){
					if (PAGES[pageId] == null)
						console.error("Page " + pageId + " in group " + matches[2] + ' does not exist');
					else if (PAGES[pageId].groupId != null){
						console.error("Page " + pageId + " in both group " + matches[2] + ' and ' + PAGES[pageId].groupId);
					}
					else {
						PAGES[pageId].groupId = matches[2];
						index[i] = PAGES[pageId];
					}
				});
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
		GROUPS.forEach(function(group, groupId){
			var pages = group.pages;
			pages.forEach(function(page, i){
				if (page == null) {
					console.error("Page " + i + " in group " + groupId + ' does not exist');
					return;
				}
			});
		});

		PAGES.forEach(function(page, pageId){
			var groupId = page.groupId;
			if (groupId == null) {
				if (GROUPS[0] == null)
					new Group({name:'#Ghost ' + 0}, 0);
				groupId = 0;
				page.groupId = 0;
			}

			if (!(groupId in GROUPS)) {
				console.warn("Group " + groupId + ' contains page ' + pageId + ' does not exist');
				new Group({name:'#Ghost ' + groupId}, groupId);
			}

			if (GROUPS[groupId].pages.indexOf(page) < 0) {
				console.warn("Page " + page.pageId + " is not in group " + groupId);
				GROUPS[groupId].pages.push(page);
				//remove(KEY.page(pageId));
			}
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
