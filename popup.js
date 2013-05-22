"use strict"


 // Variables
////////////////////////////////////////////////////////////////////////////////
var WINDOW_ID = -1;
var GROUP_ID = -1;

var messageBus;

 // Utils
////////////////////////////////////////////////////////////////////////////////
function $$(id){
	return document.getElementById(id);
}

function $$head(group){
	var id = !isNaN(parseInt(group)) ? group : group.groupId;
	return $$("group-head-" + id);
}

function $$list(group){
	var id = !isNaN(parseInt(group)) ? group : group.groupId;
	return $$("group-page-list-" + id);
}

function $$page(page){
	var id = !isNaN(parseInt(page)) ? page : page.pageId;
	return $$("page-" + id);
}

function clearChildren(node){
	while (node.hasChildNodes()){
    	node.removeChild(node.lastChild);
	}
}


function message(msg, callback){
	if(callback)
		chrome.extension.sendMessage(undefined, msg, callback);
	else
		chrome.extension.sendMessage(undefined, msg);
};

function printData(){
	chrome.storage.local.get(null, function(obj){console.log(obj)});
}

function $$width(element, width){
	if(width != undefined)
		element.style.width = width + "px";
	else
		return parseInt(element.style.width);
}

function $$height(element, height){
	if(height)
		element.style.height = height + "px";
	else
		return parseInt(element.style.height);
}



 // Action
////////////////////////////////////////////////////////////////////////////////
function createGroupAction(name, act, func){
	var item = document.createElement("li");
		item.id = "action-" + act;
		item.classList.add('action');
		var link = document.createElement("button");
			link.textContent = name;
			link.classList.add('action-button');
			link.disabled = true;
			link.addEventListener("click", function(event){
				event.preventDefault();
				if (GROUP_ID >= 0) {
					func(function(){
						var argv = Array.prototype.slice.call(arguments);
						argv.unshift(act);
						messageBus.send.apply(null, argv);
					});
				}
			});
		item.appendChild(link);
	return item;
}


function setupActions(){
	var list = $$("group-action");
		list.appendChild(createGroupAction("Open", "open-window",
			function(action){action(GROUP_ID);}));
			
		list.appendChild(createGroupAction("Rename", "rename-window",
			function(action){
				var titleNode = $$head(GROUP_ID);
				if(titleNode){
					$("#group-name-input").val(titleNode.textContent);
					$("#name-modal").on("shown", function(){$("#group-name-input").select()});
					
					var rename = function(event){
						event.preventDefault();
						var newName = $("#group-name-input").val();
						if(titleNode.textContent != newName){
							console.log(newName);
							action(newName, GROUP_ID);
						}
						$("#name-modal").modal('hide');
					}
					
					$("#name-modal").bind('submit', rename);
					$("#name-modal").modal('show');
				}
			}));
			
		list.appendChild(createGroupAction("Delete", "delete-window",
			function(action){
				action(GROUP_ID);
				GROUP_ID = -1;
			}));
}


 // Visual Elements
////////////////////////////////////////////////////////////////////////////////
function switchGroup(groupId){
	if(GROUP_ID >= 0) {
		$$head(GROUP_ID).classList.remove("selected");
		$$list(GROUP_ID).classList.remove("selected");
	}	
	if(groupId >= 0){
		GROUP_ID = parseInt(groupId);
		$$head(groupId).classList.add("selected");
		$$list(groupId).classList.add("selected");
		$$("group-action").classList.add('enable');
		$('.action-button').removeAttr('disabled');
		$$head(groupId).focus();
	}
}


function createPageElement(page){
	var item = document.createElement("li");
		item.id = "page-" + page.pageId;
		item.classList.add("page");
		item.dataset["pageid"] = page.pageId;
		item.dataset["tabid"] = page.chromeId;
		item.addEventListener('dragstart', function(event){
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData('text/x-page-id', page.pageId);
		});
		
		var link = document.createElement("a");
			link.classList.add("title");
			link.textContent = page.title;
			link.href = page.url;
			link.addEventListener("click", function(event){
				event.preventDefault();
				messageBus.send("activate-page", page.pageId);
			});
		item.appendChild(link);
	return item;
}

function createGroupElements(group){
	var gitem = document.createElement("li");
	var ghead = document.createElement("a");
		ghead.id = "group-head-" + group.groupId;
		ghead.classList.add("group-head");
		ghead.textContent = group.name;
		ghead.href = "#group-page-list-" + group.groupId;
		ghead.addEventListener("click", function(event){
			event.preventDefault();
			switchGroup(group.groupId);
		});
		
		gitem.addEventListener('dragenter', function(event){
			ghead.classList.add('drag');
		});
		gitem.addEventListener('dragleave', function(event){
			ghead.classList.remove('drag');
		});
		gitem.addEventListener('dragover', function(event){
			event.preventDefault();
		});
		gitem.addEventListener('drop', function(event){
			ghead.classList.remove('drag');
			var pageId = event.dataTransfer.getData('text/x-page-id');
			messageBus.send('move-page', pageId, group.groupId);
		});
		gitem.appendChild(ghead);
		
	var glist = document.createElement("ul");
		glist.id = "group-page-list-" + group.groupId;
		glist.classList.add("group-page-list");
			
	return [gitem, glist];
}


 //  Handlers
////////////////////////////////////////////////////////////////////////////////
function createGroup(group){
	var pair = createGroupElements(group);
	$$("group-list").appendChild(pair[0]);
	$$("pages-list").appendChild(pair[1]);
}

function removeGroup(group){
	var head = $$head(group);
	var list = $$list(group);
	head.parentNode.removeChild(head);
	list.parentNode.removeChild(list);
}

function updateGroup(group){
	var item = $$head(group);
	item.textContent = group.name;
}

function createPage(page){
	var item = createPageElement(page);
	var list = $$list(page.groupId);
		list.appendChild(item);
}

function removePage(page){
	var item = $$page(page);
	item.parentNode.removeChild(item);
}

function updatePage(page){
	var item = $$page(page);
	var link = item.getElementsByClassName("title")[0];
		link.href = page.url;
		link.textContent = page.title;
}

function attachPage(pageId, groupId, index){
	var item = $$page(pageId);
	var list = $$list(groupId);
	list.insertBefore(item, list.childNodes[index]);
}

function detachPage(pageId){
	var item = $$page(pageId);
	var list = item.parentNode;
	$$("detached").appendChild(item);
}

function movePage(pageId, groupId, index){
	var item = $$page(pageId);
	var list = item.parentNode;
	list.insertBefore(item, list.childNodes[index]);
}


 //Init
////////////////////////////////////////////////////////////////////////////////
function load(control){
	control.getGroups().forEach(function(group){
		createGroup(group);
		control.getIndex(group.groupId).forEach(function(pageId, list, index){
			createPage(control.getPage(pageId));
			attachPage(pageId, group.groupId, index);
		});
	});
}

function init(){
	clearChildren($$("group-list"));

	chrome.runtime.getBackgroundPage(function(backgroundPage){
	chrome.windows.getCurrent(function(currentWindow){
		var control = backgroundPage.control;
		load(control);
		switchGroup(control.getGroupId(currentWindow.id));

		var handler = {
			"group-create" : createGroup,
			"group-remove" : removeGroup,
			"group-update" : updateGroup,
			"page-create"  : createPage,
			"page-remove"  : removePage,
			"page-update"  : updatePage,
			"page-attach"  : attachPage,
			"page-detach"  : detachPage,
			"page-move"    : movePage
		};
	
		messageBus = new MessageBus(handler);
	})});
	
	setupActions();
}

window.addEventListener("load", init);
