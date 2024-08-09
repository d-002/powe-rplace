user places a pixel: send the command to the server
get feedback and place the pixel accordingly (depending on if the user is in cooldown)

when an user places a pixel, the server gets their ip and sets their cooldown (file of people in cooldown, updated when someone places a pixel, to delete useless lines)
the server then updates the grid chunk

every 10s? the server sends map updates to every user (list of changes stored in log files, client has a "version" to know which changes to apply)
each log file contains 1024 changes to avoid reading too much information
new clients and outdated clients (with an update process requiring to read multiple files) read from the current map file instead

/!\ version 0 is the initial version, with no changes. Hence in every file of say 10 changes, the contents are the changes that lead to versions 1+10n to 10+10n, not 0+10n to 9+10n.

downtime handling:
down page, using get parameters to make for different pages: maintenance, server loading (redirected to when the server is starting)
display a link to refresh the page, auto-refresh after 10s, show countdown
show downtime list, graph, reasons for downtime

admin page:
special page, not linked in the website, verification system needed [TODO]
can set up maintenance: edit a file with the shutdown time, server reads this file every minute and notifies the current clients
in the normal page, if the shutdown time is different than 0 and reached, the client refreshes the page (/!\ add some more time, like 10s, to make sure the backend is restarted in maintenance mode).
Need to edit the package.json file after the pages are in maintenance, but it shouldn't be an issue since files already need to be edited.

This way, editing regular files can be done in maintenance mode, and editing maintenance files can be done in normal mode.

unlock powerups:
after placing a certain number of pixels, after a certain amount of play time, when placing a pixel on the first possible frame, in a certain interval...
multiple powerups tiers

point system, get points and use them in a tree to buy upgrades

powerups:
- access more colors
- place pixels faster
- pre-place (must have window open)
Only store relevant information in users files (pixels placed...) and parse privileges with powerups file

TODO (doing now):
button to reset position
button to refresh map manually, timeout

TODO:
- mobile version (when width < height, updated on screen resize?)
- handle server stops (different script redirect)
- less file writes: options, user data, map file
- timeout for manual map refresh button
- add changelog etc popup
- login support to sync data from ip, implement passkey system in local storage
- landing page
- display currently active users
- changelog popup
- use binary data in files
- gpu acceleration
- privacy policy
- ddos protection / ip ban in admin?
- show and record graph of downtime
- user data system: create account, or checksum in localstorage for connection by ip
- option to refresh the map client-side (help)
- send email / admin logs on error
