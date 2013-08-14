// ==UserScript==
// @name        Oz' Scrobbler
// @namespace   crashoz.github.com
// @description Scrobble youtube video to last.fm
// @include     http://*.youtube.com/watch?*v=*
// @include     https://*.youtube.com/watch?*v=*
// @version     0.1
// @require     http://crypto-js.googlecode.com/svn/tags/3.1.2/build/rollups/md5.js
// @grant       GM_log
// @grant       GM_getValue
// @grant       GM_setValue
// @grant		GM_deleteValue
// @grant       GM_xmlhttpRequest
// @grant       GM_openInTab
// ==/UserScript==

const UID = "4628736146";
const lastFmAuth = "http://www.last.fm/api/auth"
const lastFmApi = "http://ws.audioscrobbler.com";
const apiKey = "";
const secretKey = "";

var authToken = "";
var sessionKey = "";
var userName = "";
var hasScrobbled = false;

function debug(text) {
    GM_log(text);
}

/**
 *  Retrieves video id, title and duration
 */
function getVideoInfo() {
    debug("retrieving video info");
    
    var parentElement = document.getElementById('watch7-container');
    if (!parentElement) {
        debug("video info container not found");
        return false;
    }
    
    var videoId = null;
    var videoTitle = null;
    var videoDuration = null;
    var nodes = parentElement.childNodes;
    var k = 0;
    for (var i=0; i < nodes.length; i++) {
        var elt = nodes[i];
        if (elt.nodeType == 1) {
            var itemprop = elt.getAttribute('itemprop');
            if (itemprop == 'name') {
                videoTitle = elt.content;
                k++;
            } else if (itemprop == 'videoId') {
                videoId = elt.content;
                k++;
            } else if (itemprop == 'duration') {
                videoDuration = parseVideoDuration(elt.content);
                k++;
            }
            
            if (k == 3) {
                break;
            }
        }
    }
    
    if (!videoTitle || !videoTitle || !videoDuration) {
        debug("missing video info");
        return false;
    }
    
    debug("video title: " + videoTitle);
    debug("video id: " + videoId);
    debug("video duration: " + videoDuration);
    return {title:videoTitle, id:videoId, duration:videoDuration};
}

/**
 *  Get video duration in seconds from a string like "PT2M45S"
 */
function parseVideoDuration(durationString) {
    var reg = /[^0-9]*(?:([0-9]+)H)?(?:([0-9]+)M)?(?:([0-9]+)S)?/m;
    var match = reg.exec(durationString);
    
    if (match) {
        var duration = 0;
        if (match[1]) {
            duration += parseInt(match[1], 10)*3600;
        }
        if (match[2]) {
            duration += parseInt(match[2], 10)*60;
        }
        if (match[3]) {
            duration += parseInt(match[3]);
        }
        return duration;
    } else {
        return false;
    }
}

/**
 *  Parse the video title to extract the artist and the title.
 *  Search for 'artist - title', otherwise let the user choose.
 */
function parseVideoTitle(title) {
    var reg = /([^\-]+) *- *(.+)/m;
    var match = reg.exec(title);
    
    if (match) {
        return {artist:match[1],title:match[2]};
    } else {
        return false;
    }
}

/** 
 *  Insert the scrobble tab in the action bar below the video
 *  between 'About' and 'Share' tabs.
 *  The tab provides access to the scrobble panel.
 */
function addScrobbleTab() {
    debug("adding scrobble tab");
    
    var parentElement = document.getElementById('watch7-secondary-actions');
    if (!parentElement) {
        debug("tab container not found");
        return false;
    }
    
    var insertElement = parentElement.childNodes[2];
    if (!insertElement) {
        debug("tab insertion node not found");
        return false;
    }
    
    var mainSpan = document.createElement('span');
    mainSpan.innerHTML = '<button type="button" '+
    'class="action-panel-trigger yt-uix-button yt-uix-button-text yt-uix-button-size-default yt-uix-tooltip" '+
    'title="" onclick=";return false;" data-trigger-for="action-panel-scrobble-' + UID +
    '" data-button-toggle="true" role="button">'+
    '<span class="yt-uix-button-content">'+
    'Scrobble'+
    '</span></button>';
    
    parentElement.insertBefore(mainSpan, insertElement);
    debug("scrobble tab added");
    return true;
}

/**
*   Insert the scrobble panel in the action panels for
*   the action bar.
*   This is the main user interface.
*/
function addScrobblePanel() {
    debug("adding scrobble panel");
    
    var parentElement = document.getElementById('watch7-action-panels');
    if (!parentElement) {
        debug("panel container not found");
        return false;
    }
    
    var insertElement = parentElement.childNodes[2];
    if (!insertElement) {
        debug("panel insertion node not found");
        return false;
    }
    
    var mainDiv = document.createElement('div');
    
    mainDiv.id = 'action-panel-scrobble-' + UID;
    mainDiv.className = 'action-panel-content hid';
    mainDiv.setAttribute('data-panel-loaded', 'true');
    mainDiv.innerHTML =
    '<table>'+
    '<tr>'+
    '<td><strong>Scrobble to last.fm</strong></td>'+
    '<td></td>'+
    '<td><button class="yt-uix-button yt-uix-button-text yt-uix-button-size-default" id="login-button-' + UID +
    '" role="button" type="button" onclick=";return false;">'+
    '<span class="yt-uix-button-content">'+
    'login'+
    '</span>'+
    '</button></td>'+
    '<tr>'+
    '<td><label for="scrobble-artist' + UID + '">Artist</label></td>'+
    '<td></td>'+
    '<td><label for="scrobble-title' + UID + '">Title</label></td>'+
    '</tr>'+
    '<tr>'+
    '<td><span class="yt-uix-form-input-container yt-uix-form-input-non-empty">'+
    '<input class="yt-uix-form-input-text" id="scrobble-artist-' + UID + '" value=""></input>'+
    '</span></td>'+
    '<td><button class="yt-uix-button yt-uix-button-text yt-uix-button-size-default" id="swap-button-' + UID +
    '" role="button" type="button" onclick=";return false;">'+
    '<span class="yt-uix-button-content">'+
    '< >'+
    '</span>'+
    '</button></td>'+
    '<td><span class="yt-uix-form-input-container yt-uix-form-input-non-empty">'+
    '<input class="yt-uix-form-input-text" id="scrobble-title-' + UID + '" value=""></input>'+
    '</span></td>'+
    '</tr>'+
    '</table>'+
    '<button class="yt-uix-button yt-uix-button-text yt-uix-button-size-default" id="scrobble-button-' + UID +
    '" role="button" type="button" onclick=";return false;">'+
    '<span class="yt-uix-button-content">'+
    'Scrobble now!'+
    '</span>'+
    '</button>'+
    '<div id="scrobble-info-' + UID + '"></div>'+
    '<div id="scrobble-advanced-' + UID + '" class="hid"><p>test</p></div>';
    
    parentElement.insertBefore(mainDiv, insertElement);
    
    var advancedButton = document.getElementById('login-button-' + UID);
    advancedButton.addEventListener('click', onLogin, true);
    
    var scrobbleButton = document.getElementById('scrobble-button-' + UID);
    scrobbleButton.addEventListener('click', onScrobble, true);
    
    var swapButton = document.getElementById('swap-button-' + UID);
    swapButton.addEventListener('click', onSwap, true);
    
    debug("scrobble panel added");
    return true;
}

/**
 *  Swap button clicked event.
 *  Shortcut for swapping the title and the artist, often interverted.
 */
function onSwap() {
    debug("swap event received");
    
    var titleInput = document.getElementById('scrobble-title-' + UID);
    var artistInput = document.getElementById('scrobble-artist-' + UID);
    
    var title = titleInput.value;
    titleInput.value = artistInput.value;
    artistInput.value = title;
    
    debug("title and artist swapped");
}

/**
 *  Scrobble button clicked event.
 *  Triggers a manual scrobble.
 */
function onScrobble() {
    debug("scrobble event received");
    
    var infoDiv = document.getElementById('scrobble-info-' + UID);
    
    // Adds spinning loading animation
    infoDiv.innerHTML =
    '<p class="yt-spinner">'+
    '<img src="//s.ytimg.com/yts/img/pixel-vfl3z5WfW.gif" class="yt-spinner-img" alt="Loading icon">'+
    '<span class="yt-spinner-message">'+
    'Sending...'+
    '</span>'+
    '</p>';
    
    if (!hasScrobbled) {
        scrobbleToLastFm();
    } else {
        displayError("already scrobbled");
    }
}

/**
 *  Init login options in the scrobble panel
 */
function onLogin() {
    debug("logging in");
    if (!loadLastFmSessionKey()) {
        if (!loadLastFmAuthToken()) {
            getLastFmAuthToken();
        } else {
            requestLastFmSessionKey();
        }
    } else {
        displaySuccess("connected as " + userName);
    }
}

/**
 *  Desktop authentication:
 *  Request an authentication token for api requests.
 *  The token is valid for 60 minutes, so we can keep it locally in cache
 *  to avoid unecessary requests.
 */
function getLastFmAuthToken() {
    debug("requesting token");
    GM_xmlhttpRequest({
        method: "GET",
        url: lastFmApi + "/2.0/?method=auth.gettoken&api_key=" + apiKey + "&format=json",
        timeout: 5000,
        onload: function(response) {
            try {
                authToken = JSON.parse(response.responseText).token;
                if (!authToken) {
                    authError(); 
                } else {
                    debug("token loaded from request: " + authToken);
                    
                    GM_setValue("authTokenTimeout", parseInt(Date.now() / 1000 + 3300));
                    GM_setValue("authToken", authToken);
                    
                    requestLastFmSessionKey();
                }
            } catch (e) {
                authError();
            }
        },
        onerror: authError
    });
}

/**
 *  Try to load the auth token from cache.
 */
function loadLastFmAuthToken() {
    var authTokenTimeout = GM_getValue("authTokenTimeout");
    if (authTokenTimeout && Date.now() / 1000 < authTokenTimeout ) {
        authToken = GM_getValue("authToken");
        if (authToken) {
            debug("token loaded from cache: " + authToken);
            return true; 
        }
    }
    
    return false;
}

/**
 *  Desktop authentication:
 *  Get user last.fm session key. 
 *  The key has infinite lifetime so we store it locally.
 */
function requestLastFmSessionKey() {
    debug("requesting session key");
    var sig = CryptoJS.MD5("api_key" + apiKey + "methodauth.getSessiontoken" + authToken + secretKey);
    GM_xmlhttpRequest({
        method: "GET",
        url: lastFmApi + "/2.0/?method=auth.getSession&api_key=" + apiKey + "&api_sig=" + sig + "&token=" + authToken + "&format=json",
        timeout: 5000,
        onload: function(response) {
            try {
                var json = JSON.parse(response.responseText)
                if (json.error) {
                    if (json.error == 14) {
                        // This token has not been authorized
                        openLastFmAuthPage();
                    } else if (json.error == 4) {
                        // Invalid authentication token supplied
                        getLastFmAuthToken();
                    } else {
                        authError();
                    }
                } else {
                    sessionKey = json.session.key;
                    userName = json.session.name;
                    debug("sessionKey loaded from request: " + sessionKey);
                    // Auth token is destroyed on getSession success
                    authToken = "";
                    authTokenTimeout = 0;
                    GM_setValue("authToken", authToken);
                    GM_setValue("authTokenTimeout", authTokenTimeout);

                    GM_setValue("sessionKey", sessionKey);
                    GM_setValue("userName", userName);
                    
                    displaySuccess("connected as " + userName);
                }
            } catch (e) {
                authError();
            }
        },
        onerror: authError
    });
}

/**
 *  Try to load the session key from cache.
 *  If it fails, it means we need to authenticate the user.
 */
function loadLastFmSessionKey() {
    sessionKey = GM_getValue("sessionKey");
    userName = GM_getValue("userName");
    if (sessionKey && userName) {
        debug("sessionKey loaded from cache: " + sessionKey);
        debug("userName loaded from cache: " + userName);
        return true; 
    } else {
        return false;
    }
}

/**
 *  Send the user to last.fm authentication page to authorize the scrobbler.
 */
function openLastFmAuthPage() {
    displayError("reload page when the scrobbler is authorized");
    GM_openInTab(lastFmAuth + "/?api_key=" + apiKey + "&token=" + authToken);
}

function authError() {
    displayError("authentication error");
}

/**
 *  Scrobble the song
 */
function scrobbleToLastFm() {
    debug("requesting scrobble");
    var artist = document.getElementById('scrobble-artist-' + UID).value;
    var title = document.getElementById('scrobble-title-' + UID).value;
    var timestamp = Math.round(Date.now() / 1000);
    
    if (!sessionKey) {
        displayError("Please log in");
    }
    
    if (!artist || !title) {
        displayError("Missing artist or title");
    }
    
    var s = "api_key" + apiKey + "artist" + artist + "method" + "track.scrobble" + "sk" + sessionKey + "timestamp" + timestamp + "track" + title + secretKey;
    
    var sig = CryptoJS.MD5(s);
    var args = "method=" + encodeURIComponent("track.scrobble") +
    "&api_key=" + encodeURIComponent(apiKey) +
    "&api_sig=" + encodeURIComponent(sig) +
    "&artist=" + encodeURIComponent(artist) +
    "&track=" + encodeURIComponent(title) +
    "&timestamp=" + encodeURIComponent(timestamp) +
    "&sk=" + encodeURIComponent(sessionKey);
    GM_xmlhttpRequest({
        method: "POST",
        url: lastFmApi + "/2.0/?format=json",
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        data: args,
        timeout: 5000,
        onload: function(response) {
            debug(response.responseText);
            try {
                var json = JSON.parse(response.responseText)
            } catch (e) {
                displayError("Scrobble error - internal error");
                return;
            }
            
            debug(json);
            
            if (json.error) {
                if (json.error == 14) {
                    // This token has not been authorized
                    displayError("Not logged in - Please log in");
                } else if (json.error == 4) {
                    // Invalid authentication token supplied
                    displayError("Not logged in - Please log in");
                } else if (json.error == 9) {
                    // Invalid session key - Please re-authenticate
                    sessionKey = "";
                    userName = "";
                    GM_setValue("sessionKey", "");
                    GM_setValue("userName", "");
                    displayError("Invalid session key - Please re-authenticate");
                } else {
                    // Other
                    displayError("Scrobble error - Network or application error");
                }
            } else if (json.scrobbles['@attr'].accepted == 1) {
                debug("scrobble successfull");
                hasScrobbled = true;
                displaySuccess("Scrobble successful");
            } else {
                displayError("Scrobble error - bad metadata");
            }
        },
        onerror: function(response) {
            displayError("Scrobble error");
        }
    });
}

function displayError(text) {
    var infoDiv = document.getElementById('scrobble-info-' + UID);
    infoDiv.innerHTML = '<p style="color:#ff0000;">' + text + '</p>';
}

function displaySuccess(text) {
    var infoDiv = document.getElementById('scrobble-info-' + UID);
    infoDiv.innerHTML = '<p style="color:#00ff00;">' + text + '</p>';
}

function main() {
    if (!addScrobblePanel()) {
        debug("cannot add panel, abort");
        return;
    }
    
    if (!addScrobbleTab()) {
        debug("cannot add tab, abort");
        return;
    }
    
    var videoInfo = getVideoInfo();
    
    var songInfo = parseVideoTitle(videoInfo.title);
    if (songInfo) {
        document.getElementById('scrobble-title-' + UID).value = songInfo.title;
        document.getElementById('scrobble-artist-' + UID).value = songInfo.artist
    }
    
    if (loadLastFmSessionKey()) {
        displaySuccess("connected as " + userName);
    } else {
        displayError("not logged in");
    }
}

// Avoid running multiple times in the same page (iframes, ...)
if (window.top != window.self)
{
    return;
} else {
    window.addEventListener("load", main, false);
}