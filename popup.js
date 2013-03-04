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

function $$group(group){
	var id = !isNaN(parseInt(group)) ? group : group.groupId;
	return $$("group-" + id);
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
		var link = document.createElement("button");
			link.textContent = name;
			link.addEventListener("click", function(event){
				event.preventDefault();
				if (GROUP_ID > 0) {
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
					$("#name-modal").modal('show');
			
					$("#group-rename-button").click(function(){
						var newName = $("#group-name-input").val();
						if(titleNode.textContent != newName){
							console.log(newName);
							action(newName, GROUP_ID);
						}
						$("#name-modal").modal('hide');
					});
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
	var prev = $$group(GROUP_ID)
	if(prev)
		prev.classList.remove("selected");
		
	if(GROUP_ID != groupId){
		GROUP_ID = parseInt(groupId);
		$$group(groupId).classList.add("selected");
		$$("group-action").classList.add('enable');
	}
	else{
		GROUP_ID = -1;
		$$("group-action").classList.remove('enable');
	}
}


function createPageElement(page){
	var item = document.createElement("li");
		item.id = "page-" + page.pageId;
		item.classList.add("page");
		item.dataset["pageid"] = page.pageId;
		item.dataset["tabid"] = page.chromeId;
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

function createGroupElement(group){
	var li = document.createElement("li");

	var gitem = document.createElement("div");
		gitem.id = "group-" + group.groupId;
		gitem.classList.add("group");
		
		var header = document.createElement("header");
		var ghead = document.createElement("a");
			ghead.id = "group-head-" + group.groupId;
			ghead.classList.add("group-head");
			ghead.textContent = group.name;
			ghead.href = "#group-page-list-" + group.groupId;
			ghead.addEventListener("click", function(event){
				event.preventDefault();
				gitem.classList.toggle("open");
				switchGroup(group.groupId);
			});
			header.appendChild(ghead);
			
		var glist = document.createElement("ul");
			glist.id = "group-page-list-" + group.groupId;
			glist.classList.add("group-page-list");
			
		gitem.appendChild(header);
		gitem.appendChild(glist);
		
		li.appendChild(gitem);
	return li;
}


 //  Handlers
////////////////////////////////////////////////////////////////////////////////
function createGroup(group){
	var list = createGroupElement(group);
	$$("group-list").appendChild(list);
}

function removeGroup(group){
	var item = $$group(group);
	item.parentNode.removeChild(item);
}

function updateGroup(group){
	var item = $$head(group);
	item.textContent = group.name;
}

function createPage(page){
	var item = createPageElement(page);
	var list = $$list(page.groupId);
		$$("detached").appendChild(item);
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
		load(backgroundPage.control);

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
	});
	
	setupActions();
}

window.addEventListener("load", init);
