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
- colors pickup

Only store relevant information in users files (pixels placed...) and parse privileges with powerups file

movement system:
chunk system: depending on the zoom, chunks of data are stored in uint8 buffers, and then blitted onto the screen
on zoom change, existing chunks can be displayed while the new ones generate: every time a chunk is generated, all the previous chunks check if they are covered, and then they are removed from the chunks array
on pixels update, only the relevant pixels are updated in the corresponding chunks, which are in turn blitted

on cam change: get the chunks of the correct zoom that collide with the screen and store them in a temporary array
- if all the needed chunks exist, display them, then delete all the chunks with a different zoom
- if not enough chunks exist, display the existing ones of other zoom, then the chunks of normal zoom from the temporary array, and iterate through all wanted chunks and add to a queue (if not in already) the chunks that do not exist
remove from the queue the chunks that are no longer needed: different zoom or not colliding
once every second: delete the chunks that are not visible but are still cached
on update: blit the chunks when out of the queue

TODO:
- css
- colors div animations
- colors div scroll
- settings
- landing page
- privacy policy
- button to reset position
- button to refresh map manually, timeout
- button to show debug?
- auto send map again if checksum is different
- show or hide borders
- better info system (queue, fadeout, default text (countdown))
- less file writes: options, user data, map file
- async map files updates, but be careful about permissions
- mobile version (when width < height, updated on screen resize (with timeout)?)
- changelog popup
- click on minimap
- login support to sync data from ip, implement passkey system in local storage
- ddos protection / ip ban in admin
- display currently active users
- gpu acceleration
- show and record graph of downtime
- user data system: create account, or checksum in localstorage for connection by ip
- better zoom and pos management
- dark theme
- send email / admin logs on error
