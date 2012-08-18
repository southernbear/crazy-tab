"use strict"


 // Variables
////////////////////////////////////////////////////////////////////////////////
var WINDOW_ID = -1;


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




 // Visual Elements
////////////////////////////////////////////////////////////////////////////////
function switchGroup(groupId){
	$$("runtime-style").textContent = 
		"#group-list .group:not(#group-" + groupId + "){display:none;}";
	$$("group-name").textContent = $$group(groupId).firstChild.textContent;
}


function sizeAllocate(list){
	var width  = list.clientWidth;
	var height = list.clientHeight;
	var margin = 5;
	var textH = 24;
	
	var mw = 80;
	var mh = 60;
	
	var children = list.getElementsByClassName("page");
	var len = children.length;
	
	var nextC;
	var shotW;
	var nextH;
	var avalR = 1;
	var currR = 0;
	
	while(avalR > currR){
		currR++;
		nextC = Math.ceil(len / currR);
		shotW = Math.floor(width / nextC) - margin * 2;
		nextH = Math.floor(shotW / 16 * 9) + textH + margin * 2;
		nextH = Math.min(nextH, Math.floor(height / currR));
		avalR = Math.floor(height / nextH);
	}
	var shotH = nextH - textH - margin  * 2;
		shotW = Math.floor(shotH / 9 * 16);
		shotH = Math.floor(shotW / 16 * 9);
		nextH = shotH + textH;
	
	var trueW = shotW;
	var trueH = nextH;
	var marginX = Math.floor((Math.floor($$width(list.parentNode)  / nextC) - trueW) / 2);
	var marginY = Math.floor((Math.floor($$height(list.parentNode) / currR) - trueH) / 2);
		
	for(var i = 0; i < len; i++){
		var child = children[i];
		var style = child.style;
		if(style){
			style.width = trueW + "px";
			style.height = trueH + "px";
			
			style.margin = marginY + "px " + marginX + "px";
			
			child.firstChild.style.width = shotW + "px";
			child.firstChild.style.height = shotH + "px";
		}
	}
}


function activatePage(pageId){
	message({action : "activate-page", pageId : pageId});
}


function createPageElement(page){
	var item = document.createElement("li");
		item.id = "page-" + page.pageId;
		item.classList.add("page");
		var link = document.createElement("a");
			link.classList.add("title");
			link.textContent = page.title;
			link.href = page.url;
			link.dataset["tabid"] = page.chromeId;
			link.dataset["pageid"] = page.pageId;
			link.addEventListener("click", function(event){
				event.preventDefault();
				activatePage(page.pageId);
			});
		item.appendChild(link);
	return item;
}

function createGroupHeadElement(group){
	var gitem = document.createElement("li");
		gitem.id = "group-head-" + group.groupId;
		gitem.classList.add("group-head");
		var link = document.createElement("a");
			link.dataset["windowid"] = group.chromeId;
			link.dataset["groupid"] = group.groupId;
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
	//TODO
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
		var model = new Model(handler);
	});
}

window.addEventListener("load", init);

