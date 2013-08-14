oz-scrobbler
============

Greasemonkey script for scrobbling automatically and manually from youtube.

You need to supply a last.fm API key and secret for the script to work.
Check the script source.

This is required to make the script server-less (unlike most greasemonkey
scrobblers, which use a third party server to handle authentication and scrobbling).

This script only makes request to last.fm API: http://ws.audioscrobbler.com
It stores data in firefox config ("about:config"), 
search for extensions.greasemonkey.scriptvals.crashoz.github.com.

A third party lib is used for MD5 hashing: 
http://crypto-js.googlecode.com/svn/tags/3.1.2/build/rollups/md5.js