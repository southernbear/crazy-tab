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
	return $$("group-head-" + id);
}

function $$page(page){
	var id = !isNaN(parseInt(page)) ? page : page.pageId;
	return $$("page-" + id);
}

function $$list(group){
	var id = !isNaN(parseInt(group)) ? group : group.groupId;
	return $$("group-" + id);
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

function createGroupAction(name, func){
	var act = parseAct(name);
	var item = document.createElement("li");
		item.id = "action-" + act;
		var link = document.createElement("a");
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
		list.appendChild(createGroupAction("Open Window",
			function(action){action({groupId : GROUP_ID});}));
			
		list.appendChild(createGroupAction("Rename Window",
			function(action){
				var titleNode = $$group(GROUP_ID).firstChild;
				$("#group-name-input").val(titleNode.textContent);
				$("#name-modal").on("shown", function(){$("#group-name-input").select()});
				$("#name-modal").modal('show');
			
				$("#group-rename-button").click(function(){
					var newName = $("#group-name-input").val();
					if(titleNode.textContent != newName){
						action({groupId : GROUP_ID, name : newName});
					}
					$("#name-modal").modal('hide');
				});
			}));
			
		list.appendChild(createGroupAction("Delete Window",
			function(action){
				action({groupId : GROUP_ID});
				switchGroup($$("group-head").firstChild.dataset["groupid"]);
			}));
}



 // Visual Elements
////////////////////////////////////////////////////////////////////////////////
function switchGroup(groupId){
	GROUP_ID = parseInt(groupId);
	$$("runtime-style").textContent = 
		"#group-list .group:not(#group-" + groupId + "){display:none;}";
	$$("group-name").textContent = $$group(groupId).firstChild.textContent;
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

function createGroupHeadElement(group){
	var gitem = document.createElement("li");
		gitem.id = "group-head-" + group.groupId;
		gitem.classList.add("group-head");
		gitem.dataset["groupid"] = group.groupId;
		gitem.dataset["windowid"] = group.chromeId;
		var link = document.createElement("a");
			link.textContent = group.name || "Window " + group.groupId;
			link.addEventListener("click", function(event){
				event.preventDefault();
				switchGroup(group.groupId);
			});
		gitem.appendChild(link);
	return gitem;
}

function createGroupElement(group){
	var gitem = document.createElement("ul");
		gitem.id = "group-" + group.groupId;
		gitem.classList.add("group");
	return gitem;
}


 //  Handlers
////////////////////////////////////////////////////////////////////////////////
function createGroup(group){
	var head = createGroupHeadElement(group);
	$$("group-head").appendChild(head);
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
	var item = $$group(group);
	item.firstChild.textContent = group.name;
	if(group.groupId == GROUP_ID){
		$$("group-name").textContent = group.name;
	}
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
	clearChildren($$("group-head"));
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
