"use strict"


 // Variables
////////////////////////////////////////////////////////////////////////////////
var WINDOW_ID = -1;
var GROUP_ID = -1;


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
function action(act, args){
	args = args || {};
	args["action"] = act;
	message(args);
}

function parseAct(name){
	return name.split(/\s+/).map(function(item){return item.toLowerCase()}).join("-");
}

function createGroupAction(name, act, func){
	var item = document.createElement("li");
		item.id = "action-" + act;
		var link = document.createElement("button");
			link.textContent = name;
			link.addEventListener("click", function(event){
				event.preventDefault();
				func(function(args){action(act, args);});
			});
		item.appendChild(link);
	return item;
}


function setupActions(){
	var list = $$("group-action");
		list.appendChild(createGroupAction("Open", "open-window",
			function(action){action({groupId : GROUP_ID});}));
			
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
							action({groupId : GROUP_ID, name : newName});
						}
						$("#name-modal").modal('hide');
					});
				}
			}));
			
		list.appendChild(createGroupAction("Delete", "delete-window",
			function(action){
				action({groupId : GROUP_ID});
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
	}
	else{
		GROUP_ID = -1;
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
				action("activate-page", {pageId : page.pageId});
			});
		item.appendChild(link);
	return item;
}

function createGroupElement(group){
	var li = document.createElement("li");

	var gitem = document.createElement("div");
		gitem.id = "group-" + group.groupId;
		gitem.classList.add("group");
		
		var ghead = document.createElement("header");
			ghead.id = "group-head-" + group.groupId;
			ghead.classList.add("group-head");
			ghead.textContent = group.name;
			ghead.addEventListener("click", function(event){
				event.preventDefault();
				gitem.classList.toggle("open");
				switchGroup(group.groupId);
			});
			
		var glist = document.createElement("ul");
			glist.id = "group-page-list-" + group.groupId;
			glist.classList.add("group-page-list");
			
		gitem.appendChild(ghead);
		gitem.appendChild(glist);
		
		li.appendChild(gitem);
	return li;
}


 //  Handlers
////////////////////////////////////////////////////////////////////////////////
function createGroup(group){
	var list = createGroupElement(group);
	$$("group-list").appendChild(list);
	
	if(group.chromeId === WINDOW_ID){
		switchGroup(group.groupId);
	}
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


function init(){
	clearChildren($$("group-list"));

	chrome.windows.getCurrent({}, function(window){
		WINDOW_ID = window.id;
	
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
		var view = new View(handler);
	});
	
	setupActions();
}

window.addEventListener("load", init);
