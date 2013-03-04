'use strict';

var Sync = function() {
	var that = this || {};
	
	var timeout = null;
	
	var setData = null;
	var removeKeys = null;
	var lastSync = 0;
	
	var getTime = function() {
		var date = new Date();
		return date.getTimezoneOffset() * 60 * 1000 + date.getTime();
	}
	
	var sync = function() {
		lastSync = getTime();
		chrome.storage.local.set({lastSync : lastSync});
		
		if (!timeout) {
			timeout = setInterval(function(){
				if (setData || removeKeys) {
					if (!setData) {
						setData = {lastSync : lastSync};
					}
					else {
						setData.lastSync = lastSync;
					}
					chrome.storage.sync.set(setData);
					if (removeKeys)
						chrome.storage.sync.remove(removeKeys);
					setData = null;
					removeKeys = null;
				}
				else {
					clearInterval(timeout);
					timeout = null;
				}
			}, 10000);
		}
		else {
		}
	};
	
	var set = function(object) {
		if (!setData) {
			setData = {};
		}
		// Merge data
		for (var key in object) {
			setData[key] = object[key];
			if (removeKeys && key in removeKeys) {
				delete removeKeys[key];
			}
		}
		
		chrome.storage.local.set(object);
		sync();
	};
	
	var remove = function(key) {
		if (!removeKeys) {
			removeKeys = [];
		}
		
		// Merge data
		removeKeys.push(key);
		if (setData && key in setData) {
			delete setData[key];
		}
		
		chrome.storage.local.remove(key);
		sync();
	};
	
	that.set = set;
	that.remove = remove;
	return that;
};
