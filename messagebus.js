'use strict';

function MessageBus(handlers) {
	var that = this || {};
	
	var _handlers = {};
	for (var action in handlers) {
		_handlers[action] = handlers[action];
	}
	
	var recv = function(message) {
		if (message.action in _handlers && message.argv) {
			_handlers[message.action].apply(null, message.argv);
		}
	}
	
	var send = function(action) {
		var argv = Array.prototype.slice.call(arguments, 1);
		chrome.extension.sendMessage({action : action, argv : argv});
	}
	
	var sendArgv = function(action, argv) {
		chrome.extension.sendMessage({action : action, argv : argv});
	}
	
	chrome.extension.onMessage.addListener(recv);
	
	that.send = send;
	that.sendArgv = sendArgv;
	return that;
}
