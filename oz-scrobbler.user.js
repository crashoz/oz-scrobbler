// ==UserScript==
// @name        Oz' Scrobbler
// @namespace   crashoz.github.com
// @description Scrobble youtube video to last.fm
// @include     http://*.youtube.com/watch?*v=*
// @include     https://*.youtube.com/watch?*v=*
// @version     0.1
// ==/UserScript==

const UID = 4628736146;

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
    var reg = /([^\-]+)-(.+)/m;
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
    '<td><button class="yt-uix-button yt-uix-button-text yt-uix-button-size-default" id="advanced-button-' + UID +
    '" role="button" type="button" onclick=";return false;">'+
    '<span class="yt-uix-button-content">'+
    'options'+
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
    
    var advancedButton = document.getElementById('advanced-button-' + UID);
    advancedButton.addEventListener('click', toggleAdvancedOptions, true);
    
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
    
    var title = document.getElementById('scrobble-title-' + UID).value;
    var artist = document.getElementById('scrobble-artist-' + UID).value;
}

/**
 *  Toggle the advanced options in the scrobble panel
 */
function toggleAdvancedOptions() {
    debug("toggling advanced options");
    var advancedDiv = document.getElementById('scrobble-advanced-' + UID);
    advancedDiv.classList.toggle('hid');
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
}

main();