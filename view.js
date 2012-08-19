"use strict"


function View(handler){
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
	
	var execQueue = [];


 // Classes
////////////////////////////////////////////////////////////////////////////////
	function Group(window, _groupId, _chromeId){
		var groupId  = parseInt(_groupId);
		var chromeId = parseInt(_chromeId);
	
		if(isNaN(groupId)) throw "Invalid id :" + _groupId;
		this.groupId  = groupId;
		this.chromeId = isNaN(chromeId) ? undefined : chromeId;
		this.name     = window.name || "Window " + groupId;
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
		return this;		
	}
	


 // Utils
////////////////////////////////////////////////////////////////////////////////
	

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
			newValue.forEach(function(pageId, index){
				handler["page-attach"](pageId, groupId, index);
			});
			break;
		case "remove" :
			oldValue.forEach(function(pageId, index){
				handler["page-detach"](pageId, groupId, index);
			});
			break;
		case "update" :
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
	
	
	
 // Load Database Functions
////////////////////////////////////////////////////////////////////////////////
	function loadDatabase (storage){
		for(key in storage){
			var matches = key.match(/^(group):(\d+)/);
			if(matches){
				var chromeId = storage[key].chromeId;
				var group = new Group(storage[key], matches[2], chromeId);
				handler["group-create"](group);
			}
		}
		for(key in storage){
			var matches = key.match(/^(page):(\d+)/);
			if(matches){
				var chromeId = storage[key].chromeId;
				var page = new Page(storage[key], matches[2], storage[key].groupId, chromeId);
				handler["page-create"](page);
			}
		}
		for(key in storage){
			var matches = key.match(/^(index):(\d+)/);
			if(matches){
				storage[key].forEach(function(pageId, index){
					handler["page-attach"](pageId, matches[2], index);
				});
			}
		}
		execQueue.shift()();
	}
	



 //Init
////////////////////////////////////////////////////////////////////////////////
	execQueue.push(function(){chrome.storage.local.get(null, loadDatabase)});
	execQueue.push(function(){chrome.storage.onChanged.addListener(modelEventHandler)});
	
	execQueue.shift()();
}
