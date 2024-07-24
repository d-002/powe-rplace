<?php
function main() {
	$ip = $_SERVER['HTTP_X_FORWARDED_FOR'];

	// encode the ip address, also get rid of potential hacks
	$ipInt = 0;
	$ipSplit = explode('.', $ip);
	for ($i = 0; $i < count($ipSplit); $i++) $ipInt = ($ipInt << 8) + intval($ipSplit[$i]);
	echo $ipInt;
}

if ($_SERVER["REQUEST_METHOD"] == "GET") {
	// don't allow manually viewing this page
	echo '<html><meta http-equiv="refresh" content="0; url=/"></html>';
} else {
	echo main();
}
?>
