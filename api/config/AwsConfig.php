<?php

class AwsConfig {
    public static function sqsClientArgs(): array {
        return [
            'region'      => self::env('AWS_REGION', 'us-east-1'),
            'version'     => 'latest',
            'credentials' => [
                'key'    => self::env('AWS_ACCESS_KEY_ID'),
                'secret' => self::env('AWS_SECRET_ACCESS_KEY'),
            ],
        ];
    }

    public static function queueUrl(): string {
        return self::env('SQS_QUEUE_URL');
    }

    private static function env(string $key, string $default = ''): string {
        return $_ENV[$key] ?? getenv($key) ?: $default;
    }
}
