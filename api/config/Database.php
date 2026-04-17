<?php

$_dotenv = dirname(__DIR__, 2) . '/.env';
if (file_exists($_dotenv)) {
    foreach (file($_dotenv, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $_line) {
        if (str_starts_with(trim($_line), '#') || !str_contains($_line, '=')) continue;
        [$_k, $_v] = explode('=', $_line, 2);
        $_ENV[trim($_k)] = trim($_v);
    }
}

class Database {
    private static ?PDO $instance = null;

    private function __construct() {}
    private function __clone() {}

    public static function connect(): PDO {
        if (self::$instance === null) {
            $host    = self::env('DB_HOST', 'localhost');
            $port    = self::env('DB_PORT', '3306');
            $dbname  = self::env('DB_NAME', 'vending_db');
            $user    = self::env('DB_USER', 'root');
            $pass    = self::env('DB_PASS', '');

            $dsn = "mysql:host={$host};port={$port};dbname={$dbname};charset=utf8mb4";

            self::$instance = new PDO($dsn, $user, $pass, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
        }

        return self::$instance;
    }

    private static function env(string $key, string $default = ''): string {
        return $_ENV[$key] ?? getenv($key) ?: $default;
    }
}
