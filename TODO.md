user places a pixel: send the command to the server
get feedback and place the pixel accordingly (depending on if the user is in cooldown)

when an user places a pixel, the server gets their ip and sets their cooldown (file of people in cooldown, updated when someone places a pixel, to delete useless lines)
the server then updates the grid chunk

every 10s? every user asks the server for changes (list of changes stored in log files, client has a "version" to know which changes to apply)
every log file (1000 changes), a snapshot is created to avoid querying too much information: new clients and very much outdated clients get changes starting from this state
each client has another server-side cooldown to limit this query

display currently active users (server map update request in the last interval*2)

unlock powerups:
after placing a certain number of pixels, after a certain amount of play time, when placing a pixel on the first possible frame, in a certain interval...
multiple powerups tiers

point system, get points and use them in a tree to buy upgrades

powerups:
- access more colors
- place pixels faster
- pre-place (must have window open)

TODO:
- handle server stops (different script redirect)
- implement cache for user data
- add message popup for when things change
- login support to sync data from ip, implement passkey system in local storage
- landing page
