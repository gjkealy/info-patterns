/*!
 * Basic postMessage Support
 *
 * Copyright (c) 2013-2016 Dave Olsen, http://dmolsen.com
 * Licensed under the MIT license
 *
 * Handles the postMessage stuff in the pattern, view-all, and style guide templates.
 *
 */

// alert the iframe parent that the pattern has loaded assuming this view was loaded in an iframe
if (self != top) {
	
	// handle the options that could be sent to the parent window
	//   - all get path
	//   - pattern & view all get a pattern partial, styleguide gets all
	//   - pattern shares lineage
	var path = window.location.toString();
	var parts = path.split("?");
	var options = { "event": "patternLab.pageLoad", "path": parts[0] };
	
	options.patternpartial = (patternData.patternPartial !== undefined) ? patternData.patternPartial : "all";
	if (patternData.lineage !== "") {
		options.lineage = patternData.lineage;
	}
	
	var targetOrigin = (window.location.protocol == "file:") ? "*" : window.location.protocol+"//"+window.location.host;
	parent.postMessage(options, targetOrigin);
	
	// find all links and add an onclick handler for replacing the iframe address so the history works
	var aTags = document.getElementsByTagName('a');
	for (var i = 0; i < aTags.length; i++) {
		aTags[i].onclick = function(e) {
			var href   = this.getAttribute("href");
			var target = this.getAttribute("target");
			if ((target !== undefined) && ((target == "_parent") || (target == "_blank"))) {
				// just do normal stuff
			} else if (href && href !== "#") {
				e.preventDefault();
				window.location.replace(href);
			} else {
				e.preventDefault();
				return false;
			}
		};
	}
	
}

// if there are clicks on the iframe make sure the nav in the iframe parent closes
var body = document.getElementsByTagName('body');
body[0].onclick = function() {
	var targetOrigin = (window.location.protocol == "file:") ? "*" : window.location.protocol+"//"+window.location.host;
	var obj = JSON.stringify({ "event": "patternLab.bodyClick", "bodyclick": "bodyclick" });
	parent.postMessage(obj,targetOrigin);
};

// watch the iframe source so that it can be sent back to everyone else.
function receiveIframeMessage(event) {
	
	// does the origin sending the message match the current host? if not dev/null the request
	if ((window.location.protocol != "file:") && (event.origin !== window.location.protocol+"//"+window.location.host)) {
		return;
	}
	
	var path;
	var data = {};
	try {
		data = (typeof event.data !== 'string') ? event.data : JSON.parse(event.data);
	} catch(e) {}
	
	if ((data.event !== undefined) && (data.event == "patternLab.updatePath")) {
		
		if (patternData.patternPartial !== undefined) {
			
			// handle patterns and the view all page
			var re = /(patterns|snapshots)\/(.*)$/;
			path = window.location.protocol+"//"+window.location.host+window.location.pathname.replace(re,'')+data.path+'?'+Date.now();
			window.location.replace(path);
			
		} else {
			
			// handle the style guide
			path = window.location.protocol+"//"+window.location.host+window.location.pathname.replace("styleguide\/html\/styleguide.html","")+data.path+'?'+Date.now();
			window.location.replace(path);
			
		}
		
	} else if ((data.event !== undefined) && (data.event == "patternLab.reload")) {
		
		// reload the location if there was a message to do so
		window.location.reload();
		
	}
	
}
window.addEventListener("message", receiveIframeMessage, false);

/*!
 * URL Handler
 *
 * Copyright (c) 2013-2014 Dave Olsen, http://dmolsen.com
 * Licensed under the MIT license
 *
 * Helps handle the initial iFrame source. Parses a string to see if it matches
 * an expected pattern in Pattern Lab. Supports Pattern Labs fuzzy pattern partial
 * matching style.
 *
 */

var urlHandler = {
	
	// set-up some default vars
	skipBack: false,
	targetOrigin: (window.location.protocol == "file:") ? "*" : window.location.protocol+"//"+window.location.host,
	
	/**
	* get the real file name for a given pattern name
	* @param  {String}       the shorthand partials syntax for a given pattern
	*
	* @return {String}       the real file path
	*/
	getFileName: function (name) {
		
		var baseDir     = "patterns";
		var fileName    = "";
		
		if (name === undefined) {
			return fileName;
		}
		
		if (name == "all") {
			return "styleguide/html/styleguide.html";
		} else if (name == "snapshots") {
			return "snapshots/index.html";
		}
		
		var paths = (name.indexOf("viewall-") != -1) ? viewAllPaths : patternPaths;
		var nameClean = name.replace("viewall-","");
		
		// look at this as a regular pattern
		var bits        = this.getPatternInfo(nameClean, paths);
		var patternType = bits[0];
		var pattern     = bits[1];
		
		if ((paths[patternType] !== undefined) && (paths[patternType][pattern] !== undefined)) {
			
			fileName = paths[patternType][pattern];
			
		} else if (paths[patternType] !== undefined) {
			
			for (var patternMatchKey in paths[patternType]) {
				if (patternMatchKey.indexOf(pattern) != -1) {
					fileName = paths[patternType][patternMatchKey];
					break;
				}
			}
		
		}
		
		if (fileName === "") {
			return fileName;
		}
		
		var regex = /\//g;
		if ((name.indexOf("viewall-") != -1) && (fileName !== "")) {
			fileName = baseDir+"/"+fileName.replace(regex,"-")+"/index.html";
		} else if (fileName !== "") {
			fileName = baseDir+"/"+fileName.replace(regex,"-")+"/"+fileName.replace(regex,"-")+".html";
		}
		
		return fileName;
	},
	
	/**
	* break up a pattern into its parts, pattern type and pattern name
	* @param  {String}       the shorthand partials syntax for a given pattern
	* @param  {Object}       the paths to be compared
	*
	* @return {Array}        the pattern type and pattern name
	*/
	getPatternInfo: function (name, paths) {
		
		var patternBits = name.split("-");
		
		var i = 1;
		var c = patternBits.length;
		
		var patternType = patternBits[0];
		while ((paths[patternType] === undefined) && (i < c)) {
			patternType += "-"+patternBits[i];
			i++;
		}
		
		var pattern = name.slice(patternType.length+1,name.length);
		
		return [patternType, pattern];
		
	},
	
	/**
	* search the request vars for a particular item
	*
	* @return {Object}       a search of the window.location.search vars
	*/
	getRequestVars: function() {
		
		// the following is taken from https://developer.mozilla.org/en-US/docs/Web/API/window.location
		var oGetVars = new (function (sSearch) {
			if (sSearch.length > 1) {
				for (var aItKey, nKeyId = 0, aCouples = sSearch.substr(1).split("&"); nKeyId < aCouples.length; nKeyId++) {
					aItKey = aCouples[nKeyId].split("=");
					this[unescape(aItKey[0])] = aItKey.length > 1 ? unescape(aItKey[1]) : "";
				}
			}
		})(window.location.search);
		
		return oGetVars;
		
	},
	
	/**
	* push a pattern onto the current history based on a click
	* @param  {String}       the shorthand partials syntax for a given pattern
	* @param  {String}       the path given by the loaded iframe
	*/
	pushPattern: function (pattern, givenPath) {
		var data         = { "pattern": pattern };
		var fileName     = urlHandler.getFileName(pattern);
		var path         = window.location.pathname;
		path             = (window.location.protocol === "file") ? path.replace("/public/index.html","public/") : path.replace(/\/index\.html/,"/");
		var expectedPath = window.location.protocol+"//"+window.location.host+path+fileName;
		if (givenPath != expectedPath) {
			// make sure to update the iframe because there was a click
			var obj = JSON.stringify({ "event": "patternLab.updatePath", "path": fileName });
			document.getElementById("sg-viewport").contentWindow.postMessage(obj, urlHandler.targetOrigin);
		} else {
			// add to the history
			var addressReplacement = (window.location.protocol == "file:") ? null : window.location.protocol+"//"+window.location.host+window.location.pathname.replace("index.html","")+"?p="+pattern;
			if (history.pushState !== undefined) {
				history.pushState(data, null, addressReplacement);
			}
			document.getElementById("title").innerHTML = "Pattern Lab - "+pattern;
			if (document.getElementById("sg-raw") !== undefined) {
				document.getElementById("sg-raw").setAttribute("href",urlHandler.getFileName(pattern));
			}
		}
	},
	
	/**
	* based on a click forward or backward modify the url and iframe source
	* @param  {Object}      event info like state and properties set in pushState()
	*/
	popPattern: function (e) {
		
		var patternName;
		var state = e.state;
		
		if (state === null) {
			this.skipBack = false;
			return;
		} else if (state !== null) {
			patternName = state.pattern;
		}
		
		var iFramePath = "";
		iFramePath = this.getFileName(patternName);
		if (iFramePath === "") {
			iFramePath = "styleguide/html/styleguide.html";
		}
		
		var obj = JSON.stringify({ "event": "patternLab.updatePath", "path": iFramePath });
		document.getElementById("sg-viewport").contentWindow.postMessage( obj, urlHandler.targetOrigin);
		document.getElementById("title").innerHTML = "Pattern Lab - "+patternName;
		document.getElementById("sg-raw").setAttribute("href",urlHandler.getFileName(patternName));
		
		/*
		if (wsnConnected !== undefined) {
			wsn.send( '{"url": "'+iFramePath+'", "patternpartial": "'+patternName+'" }' );
		}
		*/
		
	}
	
};

/**
* handle the onpopstate event
*/
window.onpopstate = function (event) {
	urlHandler.skipBack = true;
	urlHandler.popPattern(event);
};

/*!
 * Panels Util
 * For both styleguide and viewer
 *
 * Copyright (c) 2013-16 Brad Frost, http://bradfrostweb.com & Dave Olsen, http://dmolsen.com
 * Licensed under the MIT license
 *
 * @requires url-handler.js
 *
 */

var panelsUtil = {

  addClickEvents: function(templateRendered, patternPartial) {

    var els = templateRendered.querySelectorAll('#sg-'+patternPartial+'-tabs li');
    for (var i = 0; i < els.length; ++i) {
      els[i].onclick = function(e) {
        e.preventDefault();
        var patternPartial = this.getAttribute('data-patternpartial');
        var panelID = this.getAttribute('data-panelid');
        panelsUtil.show(patternPartial, panelID);
      };
    }

    return templateRendered;

  },

  show: function(patternPartial, panelID) {

    var els;

    // turn off all of the active tabs
    els = document.querySelectorAll('#sg-'+patternPartial+'-tabs li');
    for (i = 0; i < els.length; ++i) {
      els[i].classList.remove('sg-tab-title-active');
    }

    // hide all of the panels
    els = document.querySelectorAll('#sg-'+patternPartial+'-panels div.sg-tabs-panel');
    for (i = 0; i < els.length; ++i) {
      els[i].style.display = 'none';
    }

    // add active tab class
    document.getElementById('sg-'+patternPartial+'-'+panelID+'-tab').classList.add('sg-tab-title-active');

    // show the panel
    document.getElementById('sg-'+patternPartial+'-'+panelID+'-panel').style.display = 'flex';

    /*
    if (codeViewer.copyOnInit) {
      codeViewer.selectCode();
      codeViewer.copyOnInit = false;
    }
    */

  }

};

/*!
* Modal for the Styleguide Layer
* For both annotations and code/info
*
* Copyright (c) 2016 Dave Olsen, http://dmolsen.com
* Licensed under the MIT license
*
* @requires panels-util.js
* @requires url-handler.js
*
*/

var modalStyleguide = {

  // set up some defaults
  active:       [ ],
  targetOrigin: (window.location.protocol === 'file:') ? '*' : window.location.protocol+'//'+window.location.host,
  
  /**
  * initialize the modal window
  */
  onReady: function() {
    
    // go through the panel toggles and add click event
    var els = document.querySelectorAll('.sg-pattern-extra-toggle');
    for (var i = 0; i < els.length; ++i) {
      els[i].onclick = (function(e) {
          e.preventDefault();
          var patternPartial = this.getAttribute('data-patternpartial');
          modalStyleguide.toggle(patternPartial);
      });
    }
    
  },
  
  /**
  * toggle the modal window open and closed
  */
  toggle: function(patternPartial) {
    if ((modalStyleguide.active[patternPartial] === undefined) || !modalStyleguide.active[patternPartial]) {
      var el = document.getElementById('sg-pattern-data-'+patternPartial);
      modalStyleguide.patternQueryInfo(el, true);
    } else {
      modalStyleguide.close(patternPartial);
    }
    
  },

  /**
  * open the modal window
  */
  open: function(patternPartial, content) {
    
    // make sure templateRendered is modified to be an HTML element
    var div       = document.createElement('div');
    div.innerHTML = content;
    content       = document.createElement('div').appendChild(div).querySelector('div');
    
    // add click events
    content = panelsUtil.addClickEvents(content, patternPartial);
    
    // make sure the modal viewer and other options are off just in case
    modalStyleguide.close(patternPartial);
    
    // note it's turned on in the viewer
    modalStyleguide.active[patternPartial] = true;
    
    // make sure there's no content
    div = document.getElementById('sg-pattern-extra-'+patternPartial);
    if (div.childNodes.length > 0) {
      div.removeChild(div.childNodes[0]);
    }
    
    // add the content
    document.getElementById('sg-pattern-extra-'+patternPartial).appendChild(content);
    
    // show the modal
    document.getElementById('sg-pattern-extra-toggle-'+patternPartial).classList.add('active');
    document.getElementById('sg-pattern-extra-'+patternPartial).classList.add('active');
    
  },
  
  clean: function(el, tag) {
    
  },
  
  /**
  * close the modal window
  */
  close: function(patternPartial) {
    
    // not that the modal viewer is no longer active
    modalStyleguide.active[patternPartial] = false;
    
    // hide the modal, look at info-panel.js
    document.getElementById('sg-pattern-extra-toggle-'+patternPartial).classList.remove('active');
    document.getElementById('sg-pattern-extra-'+patternPartial).classList.remove('active');
    
  },
  
  /**
  * return the pattern info to the top level
  */
  patternQueryInfo: function(el, iframePassback) {
    
    // send a message to the pattern
    try {
      var obj = JSON.stringify({ 'event': 'patternLab.patternQueryInfo', 'patternData': JSON.parse(el.innerHTML), 'iframePassback': iframePassback});
      parent.postMessage(obj, modalStyleguide.targetOrigin);
    } catch(e) {}
    
  },
  
  /**
  * toggle the comment pop-up based on a user clicking on the pattern
  * based on the great MDN docs at https://developer.mozilla.org/en-US/docs/Web/API/window.postMessage
  * @param  {Object}      event info
  */
  receiveIframeMessage: function(event) {
    
    var i;
    
    // does the origin sending the message match the current host? if not dev/null the request
    if ((window.location.protocol !== 'file:') && (event.origin !== window.location.protocol+'//'+window.location.host)) {
      return;
    }
    
    var data = {};
    try {
      data = (typeof event.data !== 'string') ? event.data : JSON.parse(event.data);
    } catch(e) {}
    
    // see if it got a path to replace
    if ((data.event !== undefined) && (data.event == 'patternLab.patternQuery')) {
     
      var els, iframePassback;
      
      // find all elements related to pattern info
      els = document.querySelectorAll('.sg-pattern-data');
      iframePassback = (els.length > 1);
      
      // send each up to the parent to be read and compiled into panels
      for (i = 0; i < els.length; i++) {
        modalStyleguide.patternQueryInfo(els[i], iframePassback);
      }
      
    } else if ((data.event !== undefined) && (data.event == 'patternLab.patternModalInsert')) {
      
      // insert the previously rendered content being passed from the iframe
      modalStyleguide.open(data.patternPartial, data.modalContent);
      
    } else if ((data.event !== undefined) && (data.event == 'patternLab.patternModalClose')) {
      
      var keys = [];
      for (var k in modalStyleguide.active) {
        keys.push(k);
      }
      for (i = 0; i < keys.length; i++) {
        var patternPartial = keys[i];
        if (modalStyleguide.active[patternPartial]) {
          modalStyleguide.close(patternPartial);
        }
      }
      
    }
   
  }
 
};

// when the document is ready make sure the modal is ready
modalStyleguide.onReady();
window.addEventListener('message', modalStyleguide.receiveIframeMessage, false);
