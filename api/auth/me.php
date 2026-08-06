<?php

require_once __DIR__ . '/../config/cors.php';
setCorsHeaders();

// Apache mod_php populates PHP_AUTH_USER directly.
// For PHP-FPM behind Apache, the Authorization header needs to be forwarded.
$username = $_SERVER['PHP_AUTH_USER'] ?? null;

if ($username === null) {
    // Fallback: parse Authorization header manually (PHP-FPM / CGI)
    $header = $_SERVER['HTTP_AUTHORIZATION']
           ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
           ?? (function_exists('apache_request_headers') ? (apache_request_headers()['Authorization'] ?? '') : '');
    if (preg_match('/Basic\s+(.+)/i', $header, $m)) {
        $decoded  = base64_decode($m[1]);
        $username = explode(':', $decoded, 2)[0] ?: null;
    }
}

jsonResponse(['username' => $username]);
