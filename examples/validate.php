<?php
// Validate one file with PHP curl. PHP 8+ with the curl extension. Uses one free API call.
//   php examples/validate.php samples/valid-xrechnung-ubl.xml

if ($argc !== 2) {
    fwrite(STDERR, "usage: php validate.php FILE\n");
    exit(2);
}

$path = $argv[1];
$mime = str_ends_with(strtolower($path), ".pdf") ? "application/pdf" : "application/xml";
$file = new CURLFile($path, $mime, basename($path));

$ch = curl_init("https://checkxrechnung.com/v1/validate");
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => ["file" => $file],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 120,
]);
$body = curl_exec($ch);
if ($body === false) {
    fwrite(STDERR, curl_error($ch) . "\n");
    exit(2);
}
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
echo $body, "\n";
if ($status !== 200) {
    exit(1);
}
$report = json_decode($body, true);
exit(!empty($report["ok"]) ? 0 : 1);
