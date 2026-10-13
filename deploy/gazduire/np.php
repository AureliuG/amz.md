<?php
/**
 * Nobil Prest · shared code for the web-hosting (cPanel) version: settings, access code, data files.
 * api.php answers exactly like the Node server's src/app/api routes, so the same app works on both.
 */
declare(strict_types=1);

const NP_VERSION = '__VERSION__';
const NP_COOKIE = 'np_acces';

ini_set('display_errors', '0');
ini_set('serialize_precision', '-1');
date_default_timezone_set('UTC');

$NP_CONFIG = (function (): array {
    $f = __DIR__ . '/config.php';
    $c = is_file($f) ? require $f : [];
    return (is_array($c) ? $c : []) + ['cod_birou' => '', 'cod_sofer' => '', 'cheie_gps' => '', 'sare' => '', 'date' => ''];
})();

function np_cfg(string $key): string
{
    global $NP_CONFIG;
    return trim((string) ($NP_CONFIG[$key] ?? ''));
}

function np_now(): int
{
    return (int) floor(microtime(true) * 1000);
}

/** Calendar day in Moldova (YYYY-MM-DD), whatever the server's timezone. */
function np_day(?int $ms = null): string
{
    $d = new DateTime('@' . intdiv($ms ?? np_now(), 1000));
    $d->setTimezone(new DateTimeZone('Europe/Chisinau'));
    return $d->format('Y-m-d');
}

function np_is_day($s): bool
{
    return is_string($s) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $s) === 1;
}

/** First $n characters (UTF-8), also on hosts without the mbstring extension. */
function np_cut(string $s, int $n): string
{
    if (function_exists('mb_substr')) return mb_substr($s, 0, $n, 'UTF-8');
    return preg_match('/^.{0,' . $n . '}/su', $s, $m) ? $m[0] : substr($s, 0, $n);
}

function np_len(string $s): int
{
    return function_exists('mb_strlen') ? mb_strlen($s, 'UTF-8') : (int) preg_match_all('/./su', $s);
}

function np_json($v): string
{
    return (string) json_encode($v, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
}

/* ---------- data folder (outside the web folder when possible) ---------- */

function np_data_dir(): string
{
    static $dir = null;
    if ($dir !== null) return $dir;
    $candidates = [];
    if (np_cfg('date') !== '') $candidates[] = np_cfg('date');
    $candidates[] = dirname(__DIR__, 2) . '/nobilprest-date-' . basename(__DIR__);
    $candidates[] = __DIR__ . '/date';
    foreach ($candidates as $c) {
        if ((is_dir($c) || @mkdir($c, 0750, true)) && is_writable($c)) {
            $dir = $c;
            break;
        }
    }
    $dir = $dir ?? end($candidates);
    // Inside the web folder: make sure the server never shows it (gate.php refuses it too).
    if (strpos($dir, __DIR__) === 0 && is_dir($dir) && !is_file("$dir/.htaccess")) {
        @file_put_contents("$dir/.htaccess", "Require all denied\nDeny from all\n");
    }
    return $dir;
}

function np_writable(): bool
{
    $probe = np_data_dir() . '/.probe-' . bin2hex(random_bytes(4));
    if (@file_put_contents($probe, 'ok') === false) return false;
    @unlink($probe);
    return true;
}

function np_read(string $name, $fallback)
{
    $f = np_data_dir() . '/' . $name;
    $s = is_file($f) ? @file_get_contents($f) : false;
    if ($s === false) return $fallback;
    $v = json_decode($s, false);
    return json_last_error() === JSON_ERROR_NONE ? $v : $fallback;
}

/** Runs $fn while holding an exclusive lock for that file, so concurrent requests can't interleave. */
function np_locked(string $name, callable $fn)
{
    $f = np_data_dir() . '/' . $name;
    @mkdir(dirname($f), 0750, true);
    $h = fopen("$f.lock", 'c');
    if ($h) flock($h, LOCK_EX);
    try {
        return $fn($f);
    } finally {
        if ($h) {
            flock($h, LOCK_UN);
            fclose($h);
        }
    }
}

function np_put(string $file, $value): void
{
    $tmp = $file . '.' . bin2hex(random_bytes(4)) . '.tmp';
    file_put_contents($tmp, np_json($value));
    rename($tmp, $file);
}

function np_write(string $name, $value): void
{
    np_locked($name, function ($f) use ($value) {
        np_put($f, $value);
    });
}

/** Read-modify-write a JSON document without losing concurrent updates. */
function np_update(string $name, $fallback, callable $fn)
{
    return np_locked($name, function ($f) use ($name, $fallback, $fn) {
        $next = $fn(np_read($name, $fallback));
        np_put($f, $next);
        return $next;
    });
}

function np_append(string $kind, string $day, array $entries): void
{
    if (!$entries) return;
    $dir = np_data_dir() . "/$kind";
    @mkdir($dir, 0750, true);
    $text = '';
    foreach ($entries as $e) $text .= np_json($e) . "\n";
    file_put_contents("$dir/$day.ndjson", $text, FILE_APPEND | LOCK_EX);
}

function np_read_log(string $kind, string $day): array
{
    $f = np_data_dir() . "/$kind/$day.ndjson";
    if (!is_file($f)) return [];
    $out = [];
    foreach (file($f, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
        $v = json_decode($line, false);
        if ($v !== null) $out[] = $v;
    }
    return $out;
}

function np_list_days(string $kind): array
{
    $days = array_map(fn($f) => basename($f, '.ndjson'), glob(np_data_dir() . "/$kind/*.ndjson") ?: []);
    sort($days);
    return $days;
}

/* ---------- access code ---------- */

function np_base(): string
{
    return rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
}

function np_https(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https' || (string) ($_SERVER['SERVER_PORT'] ?? '') === '443';
}

function np_code(string $role): string
{
    return np_cfg($role === 'driver' ? 'cod_sofer' : 'cod_birou');
}

/** Cookie value for a role. Changes when the code or the "sare" changes, which logs everyone out. */
function np_key(string $role): string
{
    return $role[0] . substr(hash_hmac('sha256', $role . '|' . strtoupper(np_code($role)), np_cfg('sare') . '|nobilprest'), 0, 40);
}

/** "office", "driver" or null (not logged in). No office code = open, like the Node server without passwords. */
function np_role(): ?string
{
    if (np_code('office') === '') return 'office';
    $c = $_COOKIE[NP_COOKIE] ?? '';
    if (!is_string($c) || $c === '') return null;
    if (hash_equals(np_key('office'), $c)) return 'office';
    if (np_code('driver') !== '' && hash_equals(np_key('driver'), $c)) return 'driver';
    return null;
}

/** Which role an entered code opens (spaces and upper/lower case don't matter). */
function np_check_code($entered): ?string
{
    $e = strtoupper(preg_replace('/\s+/', '', (string) $entered) ?? '');
    if ($e === '') return null;
    if (hash_equals(strtoupper(np_code('office')), $e)) return 'office';
    if (np_code('driver') !== '' && hash_equals(strtoupper(np_code('driver')), $e)) return 'driver';
    return null;
}

function np_set_cookie(string $value, int $days = 400): void
{
    setcookie(NP_COOKIE, $value, ['expires' => $value === '' ? time() - 3600 : time() + $days * 86400, 'path' => np_base() . '/', 'secure' => np_https(), 'httponly' => true, 'samesite' => 'Lax']);
}

/** Wrong codes: at most 10 per address in 15 minutes. */
function np_throttled(string $ip): bool
{
    $list = np_read('acces-esuat.json', new stdClass());
    $recent = array_filter((array) ($list->{$ip} ?? []), fn($t) => $t > np_now() - 15 * 60000);
    return count($recent) >= 10;
}

function np_fail(string $ip): void
{
    np_update('acces-esuat.json', new stdClass(), function ($list) use ($ip) {
        $out = new stdClass();
        foreach ((is_object($list) ? (array) $list : []) as $k => $times) {
            $keep = array_values(array_filter((array) $times, fn($t) => $t > np_now() - 15 * 60000));
            if ($keep) $out->{$k} = $keep;
        }
        $out->{$ip} = array_merge($out->{$ip} ?? [], [np_now()]);
        return $out;
    });
}
