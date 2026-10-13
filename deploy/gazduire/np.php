<?php
/**
 * Nobil Prest · shared code for the web-hosting (cPanel) version: settings, access code, data files.
 * api.php answers exactly like the Node server's src/app/api routes, so the same app works on both.
 *
 * Written to run on old PHP too (5.4 and newer): no type hints, no ?? / fn / <=>, so it works
 * whatever PHP version the hosting account has selected.
 */

define('NP_VERSION', '__VERSION__');
define('NP_COOKIE', 'np_acces');

ini_set('display_errors', '0');
if (PHP_VERSION_ID >= 70100) ini_set('serialize_precision', '-1');
date_default_timezone_set('UTC');

if (!function_exists('hash_equals')) {
    function hash_equals($a, $b)
    {
        if (!is_string($a) || !is_string($b) || strlen($a) !== strlen($b)) return false;
        $r = 0;
        for ($i = 0; $i < strlen($a); $i++) $r |= ord($a[$i]) ^ ord($b[$i]);
        return $r === 0;
    }
}

/** $v[$key] or $v->$key if it is set, else $default. */
function np_get($v, $key, $default = null)
{
    if (is_array($v)) return isset($v[$key]) ? $v[$key] : $default;
    if (is_object($v)) return isset($v->$key) ? $v->$key : $default;
    return $default;
}

$NP_CONFIG = array('cod_birou' => '', 'cod_sofer' => '', 'cheie_gps' => '', 'sare' => '', 'date' => '');
if (is_file(__DIR__ . '/config.php')) {
    $np_c = require __DIR__ . '/config.php';
    if (is_array($np_c)) $NP_CONFIG = array_merge($NP_CONFIG, $np_c);
}

function np_cfg($key)
{
    global $NP_CONFIG;
    return trim((string) np_get($NP_CONFIG, $key, ''));
}

function np_now()
{
    return (int) floor(microtime(true) * 1000);
}

function np_rand_hex($bytes)
{
    if (function_exists('random_bytes')) return bin2hex(random_bytes($bytes));
    if (function_exists('openssl_random_pseudo_bytes')) return bin2hex(openssl_random_pseudo_bytes($bytes));
    $s = '';
    for ($i = 0; $i < $bytes; $i++) $s .= sprintf('%02x', mt_rand(0, 255));
    return $s;
}

/** Calendar day in Moldova (YYYY-MM-DD), whatever the server's timezone. */
function np_day($ms = null)
{
    $d = new DateTime('@' . (int) floor(($ms === null ? np_now() : $ms) / 1000));
    $d->setTimezone(new DateTimeZone('Europe/Chisinau'));
    return $d->format('Y-m-d');
}

function np_is_day($s)
{
    return is_string($s) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $s) === 1;
}

/** First $n characters (UTF-8), also on hosts without the mbstring extension. */
function np_cut($s, $n)
{
    $s = (string) $s;
    if (function_exists('mb_substr')) return mb_substr($s, 0, $n, 'UTF-8');
    return preg_match('/^.{0,' . (int) $n . '}/su', $s, $m) ? $m[0] : substr($s, 0, $n);
}

function np_len($s)
{
    return function_exists('mb_strlen') ? mb_strlen((string) $s, 'UTF-8') : (int) preg_match_all('/./su', (string) $s, $m);
}

function np_json($v)
{
    $flags = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | (defined('JSON_INVALID_UTF8_SUBSTITUTE') ? JSON_INVALID_UTF8_SUBSTITUTE : 0);
    return (string) json_encode($v, $flags);
}

/* ---------- data folder (outside the web folder when possible) ---------- */

/** Where the data can go, in order of preference. verificare.php shows the same list. */
function np_data_candidates()
{
    $list = array();
    if (np_cfg('date') !== '') $list[] = np_cfg('date');
    $list[] = dirname(dirname(__DIR__)) . '/nobilprest-date-' . basename(__DIR__);
    $list[] = __DIR__ . '/date';
    return $list;
}

function np_data_dir()
{
    static $dir = null;
    if ($dir !== null) return $dir;
    $candidates = np_data_candidates();
    foreach ($candidates as $c) {
        if ((@is_dir($c) || @mkdir($c, 0750, true)) && @is_writable($c)) {
            $dir = $c;
            break;
        }
    }
    if ($dir === null) $dir = $candidates[count($candidates) - 1];
    // Inside the web folder: make sure the server never shows it (gate.php refuses it too).
    if (strpos($dir, __DIR__) === 0 && is_dir($dir) && !is_file("$dir/.htaccess")) {
        @file_put_contents("$dir/.htaccess", "Require all denied\nDeny from all\n");
    }
    return $dir;
}

function np_writable()
{
    $probe = np_data_dir() . '/.probe-' . np_rand_hex(4);
    if (@file_put_contents($probe, 'ok') === false) return false;
    @unlink($probe);
    return true;
}

function np_read($name, $fallback)
{
    $f = np_data_dir() . '/' . $name;
    $s = is_file($f) ? @file_get_contents($f) : false;
    if ($s === false) return $fallback;
    $v = json_decode($s, false);
    return json_last_error() === JSON_ERROR_NONE ? $v : $fallback;
}

/** Runs $fn while holding an exclusive lock for that file, so concurrent requests can't interleave. */
function np_locked($name, $fn)
{
    $f = np_data_dir() . '/' . $name;
    if (!is_dir(dirname($f))) @mkdir(dirname($f), 0750, true);
    $h = @fopen("$f.lock", 'c');
    if ($h) flock($h, LOCK_EX);
    $result = call_user_func($fn, $f);
    if ($h) {
        flock($h, LOCK_UN);
        fclose($h);
    }
    return $result;
}

function np_put($file, $value)
{
    $tmp = $file . '.' . np_rand_hex(4) . '.tmp';
    file_put_contents($tmp, np_json($value));
    rename($tmp, $file);
}

function np_write($name, $value)
{
    np_locked($name, function ($f) use ($value) {
        np_put($f, $value);
    });
}

/** Read-modify-write a JSON document without losing concurrent updates. */
function np_update($name, $fallback, $fn)
{
    return np_locked($name, function ($f) use ($name, $fallback, $fn) {
        $next = call_user_func($fn, np_read($name, $fallback));
        np_put($f, $next);
        return $next;
    });
}

function np_append($kind, $day, $entries)
{
    if (!$entries) return;
    $dir = np_data_dir() . "/$kind";
    if (!is_dir($dir)) @mkdir($dir, 0750, true);
    $text = '';
    foreach ($entries as $e) $text .= np_json($e) . "\n";
    file_put_contents("$dir/$day.ndjson", $text, FILE_APPEND | LOCK_EX);
}

function np_read_log($kind, $day)
{
    $f = np_data_dir() . "/$kind/$day.ndjson";
    if (!is_file($f)) return array();
    $lines = file($f, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    $out = array();
    foreach ($lines ? $lines : array() as $line) {
        $v = json_decode($line, false);
        if ($v !== null) $out[] = $v;
    }
    return $out;
}

function np_list_days($kind)
{
    $files = glob(np_data_dir() . "/$kind/*.ndjson");
    $days = array();
    foreach ($files ? $files : array() as $f) $days[] = basename($f, '.ndjson');
    sort($days);
    return $days;
}

/* ---------- access code ---------- */

function np_base()
{
    return rtrim(str_replace('\\', '/', dirname(isset($_SERVER['SCRIPT_NAME']) ? $_SERVER['SCRIPT_NAME'] : '/')), '/');
}

function np_https()
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || np_get($_SERVER, 'HTTP_X_FORWARDED_PROTO') === 'https' || (string) np_get($_SERVER, 'SERVER_PORT') === '443';
}

function np_code($role)
{
    return np_cfg($role === 'driver' ? 'cod_sofer' : 'cod_birou');
}

/** Cookie value for a role. Changes when the code or the "sare" changes, which logs everyone out. */
function np_key($role)
{
    return $role[0] . substr(hash_hmac('sha256', $role . '|' . strtoupper(np_code($role)), np_cfg('sare') . '|nobilprest'), 0, 40);
}

/** "office", "driver" or null (not logged in). No office code = open, like the Node server without passwords. */
function np_role()
{
    if (np_code('office') === '') return 'office';
    $c = np_get($_COOKIE, NP_COOKIE, '');
    if (!is_string($c) || $c === '') return null;
    if (hash_equals(np_key('office'), $c)) return 'office';
    if (np_code('driver') !== '' && hash_equals(np_key('driver'), $c)) return 'driver';
    return null;
}

/** Which role an entered code opens (spaces and upper/lower case don't matter). */
function np_check_code($entered)
{
    $e = strtoupper((string) preg_replace('/\s+/', '', (string) $entered));
    if ($e === '') return null;
    if (hash_equals(strtoupper(np_code('office')), $e)) return 'office';
    if (np_code('driver') !== '' && hash_equals(strtoupper(np_code('driver')), $e)) return 'driver';
    return null;
}

/** Remembers the code on this browser (a year); an empty value logs out. */
function np_set_cookie($value)
{
    $days = $value === '' ? -1 : 400;
    $cookie = NP_COOKIE . '=' . rawurlencode($value)
        . '; Expires=' . gmdate('D, d M Y H:i:s', time() + $days * 86400) . ' GMT'
        . '; Max-Age=' . ($days * 86400)
        . '; Path=' . np_base() . '/'
        . '; HttpOnly; SameSite=Lax'
        . (np_https() ? '; Secure' : '');
    header('Set-Cookie: ' . $cookie, false);
}

/** Wrong codes: at most 10 per address in 15 minutes. */
function np_recent_fails($times)
{
    $keep = array();
    foreach ((array) $times as $t) if ($t > np_now() - 15 * 60000) $keep[] = $t;
    return $keep;
}

function np_throttled($ip)
{
    $list = np_read('acces-esuat.json', new stdClass());
    return count(np_recent_fails(np_get($list, $ip, array()))) >= 10;
}

function np_fail($ip)
{
    np_update('acces-esuat.json', new stdClass(), function ($list) use ($ip) {
        $out = new stdClass();
        foreach (is_object($list) ? (array) $list : array() as $k => $times) {
            $keep = np_recent_fails($times);
            if ($keep) $out->$k = $keep;
        }
        $mine = np_get($out, $ip, array());
        $mine[] = np_now();
        $out->$ip = $mine;
        return $out;
    });
}
