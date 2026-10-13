<?php
/**
 * Nobil Prest · API for the web-hosting version. Same routes and answers as the Node server (src/app/api):
 *   state (GET/PATCH), events (GET/POST), gps (GET/POST), driver/position (POST), feedback (GET/POST/PATCH), info, health.
 * .htaccess sends /api/<route> here as api.php?r=<route>.
 */
require __DIR__ . '/np.php';

function np_send($data, $status = 200)
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo np_json($data);
    exit;
}

function np_raw_body()
{
    static $raw = null;
    if ($raw === null) $raw = (string) file_get_contents('php://input');
    return $raw;
}

function np_body()
{
    $v = json_decode(np_raw_body(), false);
    return json_last_error() === JSON_ERROR_NONE ? $v : null;
}

function np_clip($v, $n)
{
    return np_cut(is_scalar($v) ? trim((string) $v) : '', $n);
}

function np_is_num($v)
{
    return (is_int($v) || is_float($v)) && is_finite((float) $v);
}

function np_lnglat($v)
{
    return is_array($v) && count($v) === 2 && np_is_num(np_get($v, 0)) && np_is_num(np_get($v, 1));
}

/** Provider-style number: 47.02, "47.02" or "47,02". */
function np_num($v)
{
    if (is_string($v)) $v = str_replace(',', '.', trim($v));
    return is_numeric($v) && is_finite((float) $v) ? (float) $v : null;
}

/** First value that is set among the keys (like a ?? b ?? c). */
function np_first($obj, $keys)
{
    foreach ($keys as $k) {
        $v = np_get($obj, $k);
        if ($v !== null) return $v;
    }
    return null;
}

function np_auth_header()
{
    foreach (array('HTTP_AUTHORIZATION', 'REDIRECT_HTTP_AUTHORIZATION') as $k) {
        if (!empty($_SERVER[$k])) return (string) $_SERVER[$k];
    }
    if (function_exists('getallheaders')) {
        foreach (getallheaders() as $k => $v) if (strtolower((string) $k) === 'authorization') return (string) $v;
    }
    return '';
}

/** Default tracker IDs of the fleet (from src/lib/seed.ts), written by the package script. */
function np_default_trackers()
{
    $f = __DIR__ . '/np-flota.php';
    $list = is_file($f) ? require $f : array();
    return is_array($list) ? $list : array();
}

/** Milliseconds from a provider timestamp (seconds, milliseconds or a date text); null if unreadable. */
function np_ts($raw)
{
    if (!$raw) return np_now();
    if (is_numeric($raw)) return (int) round((float) $raw < 1e12 ? (float) $raw * 1000 : (float) $raw);
    if (!is_string($raw)) return null;
    try {
        $d = new DateTime($raw);
    } catch (Exception $e) {
        return null;
    }
    return (int) $d->format('U') * 1000 + (int) floor((int) $d->format('u') / 1000);
}

/** Stores GPS positions: latest per tracker (gps-latest.json) + the day's history (gps/<day>.ndjson). */
function np_ingest($items, $source)
{
    $accepted = 0;
    $rejected = array();
    $log = array();
    foreach (array_slice($items, 0, 5000) as $i => $it) {
        if (!is_object($it)) {
            $rejected[] = $i;
            continue;
        }
        $id = np_first($it, array('tracker', 'id', 'imei'));
        $tracker = is_scalar($id) ? trim((string) $id) : '';
        $lat = np_num(np_first($it, array('lat', 'latitude')));
        $lng = np_num(np_first($it, array('lng', 'lon', 'longitude')));
        $ts = np_ts(np_get($it, 'ts'));
        if ($tracker === '' || $lat === null || $lng === null || abs($lat) > 90 || abs($lng) > 180 || $ts === null) {
            $rejected[] = $i;
            continue;
        }
        $p = array('tracker' => $tracker, 'lat' => $lat, 'lng' => $lng, 'ts' => $ts);
        $speed = np_num(np_get($it, 'speed'));
        $heading = np_num(np_first($it, array('heading', 'course')));
        if ($speed !== null) $p['speed'] = $speed;
        if ($heading !== null) $p['heading'] = $heading;
        $p['source'] = $source;
        $log[] = $p;
        $accepted++;
    }
    if ($log) {
        $byDay = array();
        foreach ($log as $p) $byDay[np_day($p['ts'])][] = $p;
        foreach ($byDay as $day => $list) np_append('gps', $day, $list);
        np_update('gps-latest.json', new stdClass(), function ($latest) use ($log) {
            if (!is_object($latest)) $latest = new stdClass();
            foreach ($log as $p) {
                $t = $p['tracker'];
                $prev = np_get($latest, $t);
                if (!$prev || np_get($prev, 'ts', 0) <= $p['ts']) {
                    unset($p['tracker']);
                    $latest->$t = (object) $p;
                }
            }
            return $latest;
        });
    }
    return array('accepted' => $accepted, 'rejected' => $rejected);
}

function np_count_fixes($fixes, $phone, $since)
{
    $n = 0;
    foreach ($fixes as $p) {
        if (!is_object($p) || (np_get($p, 'source') === 'phone') !== $phone) continue;
        if ($since === null || np_get($p, 'ts', 0) > $since) $n++;
    }
    return $n;
}

$route = trim((string) np_get($_GET, 'r', ''), '/');
$method = (string) np_get($_SERVER, 'REQUEST_METHOD', 'GET');

// Health check for monitoring: open, shows only the version.
if ($route === 'health') np_send(array('ok' => true, 'version' => NP_VERSION));

// Access: the GPS provider uses its own key; everyone else the access code (cookie set by gate.php).
$role = np_role();
if ($route === 'gps' && $method === 'POST' && np_cfg('cheie_gps') !== '') {
    $key = np_cfg('cheie_gps');
    if (!hash_equals("Bearer $key", np_auth_header()) && !hash_equals($key, (string) np_get($_GET, 'token', ''))) np_send(array('error' => 'unauthorized'), 401);
} elseif ($role === null) {
    np_send(array('error' => 'Introduceți codul de acces.'), 401);
} elseif ($role === 'driver') {
    // Drivers: their page's calls, reading the plan and sending suggestions.
    $ok = $route === 'events' || strpos($route, 'driver/') === 0 || ($route === 'state' && $method === 'GET') || ($route === 'feedback' && $method === 'POST');
    if (!$ok) np_send(array('error' => 'Acces doar la pagina Șofer'), 403);
}

switch ("$method $route") {
    /* Shared settings: imported institutions, warehouse location, fleet cards. */
    case 'GET state':
        np_send(array(
            'institutions' => np_read('institutions.json', null),
            'warehouse' => np_get(np_read('settings.json', null), 'warehouse'),
            'fleet' => np_read('fleet.json', null),
        ));

    case 'PATCH state':
        $b = np_body();
        if (!is_object($b)) np_send(array('error' => 'invalid JSON'), 400);
        $writes = array();
        if (property_exists($b, 'institutions')) {
            $v = $b->institutions;
            $ok = $v === null || (is_array($v) && count($v) <= 20000);
            if ($ok && $v !== null) {
                foreach ($v as $i) {
                    if (!is_object($i) || !is_string(np_get($i, 'id')) || !is_string(np_get($i, 'name')) || !np_lnglat(np_get($i, 'pos'))) $ok = false;
                }
            }
            if (!$ok) np_send(array('error' => 'invalid institutions'), 400);
            $writes['institutions.json'] = $v;
        }
        if (property_exists($b, 'warehouse')) {
            if ($b->warehouse !== null && !np_lnglat($b->warehouse)) np_send(array('error' => 'invalid warehouse'), 400);
            $writes['settings.json'] = array('warehouse' => $b->warehouse);
        }
        if (property_exists($b, 'fleet')) {
            $v = $b->fleet;
            $ok = $v === null || (is_array($v) && count($v) <= 100);
            if ($ok && $v !== null) {
                foreach ($v as $t) {
                    if (!is_object($t) || !is_int(np_get($t, 'number')) || $t->number <= 0 || !is_string(np_get($t, 'plate')) || !np_is_num(np_get($t, 'capacityKg'))) $ok = false;
                }
            }
            if (!$ok) np_send(array('error' => 'invalid fleet'), 400);
            $writes['fleet.json'] = $v;
        }
        foreach ($writes as $name => $v) np_write($name, $v);
        np_send(array('ok' => true));

    /* Delivery confirmations from drivers. */
    case 'POST events':
        $b = np_body();
        $truck = np_get($b, 'truck');
        $truckOk = is_int($truck) || (is_string($truck) && preg_match('/^\s*-?\d+\s*$/', $truck)) || (is_float($truck) && floor($truck) == $truck);
        $orderNo = np_get($b, 'orderNo');
        if (!is_object($b) || !is_string($orderNo) || $orderNo === '' || !in_array(np_get($b, 'status'), array('arrived', 'delivered', 'problem'), true) || !$truckOk) {
            np_send(array('error' => 'orderNo, truck and status are required'), 400);
        }
        $c = array('orderNo' => np_cut($orderNo, 64), 'truck' => (int) $truck, 'status' => $b->status);
        $reason = np_get($b, 'reason');
        if ($reason) $c['reason'] = np_cut(is_scalar($reason) ? (string) $reason : '', 200);
        $c['ts'] = np_now();
        np_append('events', np_day($c['ts']), array($c));
        np_send(array('ok' => true, 'confirmation' => $c));

    case 'GET events':
        $day = np_is_day(np_get($_GET, 'day')) ? $_GET['day'] : np_day();
        $latest = new stdClass();
        foreach (np_read_log('events', $day) as $c) {
            $no = np_get($c, 'orderNo');
            if (is_string($no) && $no !== '') $latest->$no = $c;
        }
        np_send(array('day' => $day, 'confirmations' => $latest));

    /* GPS positions: from the provider (POST) and for the map (GET). */
    case 'POST gps':
        $b = np_body();
        if ($b === null && trim(np_raw_body()) !== 'null') np_send(array('error' => 'invalid JSON'), 400);
        np_send(np_ingest(is_array($b) ? $b : array($b), 'tracker'));

    case 'GET gps':
        $tracker = np_get($_GET, 'tracker');
        if (is_string($tracker) && $tracker !== '') {
            $day = np_is_day(np_get($_GET, 'day')) ? $_GET['day'] : np_day();
            $points = array();
            foreach (np_read_log('gps', $day) as $p) if ((string) np_get($p, 'tracker', '') === $tracker) $points[] = $p;
            np_send(array('tracker' => $tracker, 'day' => $day, 'points' => $points));
        }
        $latest = np_read('gps-latest.json', new stdClass());
        np_send(array('positions' => is_object($latest) ? $latest : new stdClass(), 'serverTime' => np_now()));

    /* Position from a driver's phone, for trucks whose tracker doesn't report. */
    case 'POST driver/position':
        $b = np_body();
        $n = is_numeric(np_get($b, 'truck')) ? (float) $b->truck : 0;
        if (!is_object($b) || floor($n) != $n || $n < 1) np_send(array('error' => 'truck required'), 400);
        $n = (int) $n;
        $fleet = np_read('fleet.json', null);
        $tracker = '';
        if (is_array($fleet)) {
            foreach ($fleet as $f) {
                if (np_get($f, 'number') === $n) {
                    $tracker = (string) np_get($f, 'trackerId', '');
                    break;
                }
            }
        } else {
            $tracker = (string) np_get(np_default_trackers(), $n, '');
        }
        $pos = (object) array('tracker' => $tracker !== '' ? $tracker : "T$n", 'lat' => np_get($b, 'lat'), 'lng' => np_get($b, 'lng'), 'speed' => np_get($b, 'speed'), 'heading' => np_get($b, 'heading'));
        np_send(np_ingest(array($pos), 'phone'));

    /* Suggestions, problems and questions (Ghid → Propuneri). */
    case 'GET feedback':
        $items = np_read('feedback.json', array());
        $items = is_array($items) ? $items : array();
        usort($items, function ($a, $b) {
            $x = np_get($a, 'ts', 0);
            $y = np_get($b, 'ts', 0);
            return $x == $y ? 0 : ($x < $y ? 1 : -1);
        });
        np_send(array('items' => $items));

    case 'POST feedback':
        $b = np_body();
        $text = np_clip(np_get($b, 'text', ''), 4000);
        if (!is_object($b) || np_len($text) < 3) np_send(array('error' => 'Scrieți descrierea (minim 3 caractere).'), 400);
        $page = np_clip(np_get($b, 'page', ''), 60);
        $page = $page !== '' ? $page : 'General';
        $name = np_clip(np_get($b, 'name', ''), 80);
        $kind = np_get($b, 'kind');
        $priority = np_get($b, 'priority');
        $item = array(
            'id' => 'F' . base_convert((string) np_now(), 10, 36) . substr(base_convert(np_rand_hex(4), 16, 36), 0, 4),
            'ts' => np_now(),
            'name' => $name !== '' ? $name : 'Anonim',
            'kind' => in_array($kind, array('problema', 'propunere', 'intrebare'), true) ? $kind : 'propunere',
            'page' => $page,
            'text' => $text,
            'priority' => in_array($priority, array('mica', 'medie', 'mare'), true) ? $priority : 'medie',
            'status' => 'nou',
            'version' => NP_VERSION,
            'from' => $role === 'driver' || $page === 'Șofer' ? 'sofer' : 'birou',
        );
        np_update('feedback.json', array(), function ($list) use ($item) {
            $list = is_array($list) ? $list : array();
            $list[] = $item;
            return array_slice($list, -2000);
        });
        np_send(array('ok' => true, 'item' => $item));

    case 'PATCH feedback':
        $b = np_body();
        $id = np_get($b, 'id');
        if (!is_object($b) || !is_string($id) || $id === '') np_send(array('error' => 'id required'), 400);
        if (property_exists($b, 'status') && !in_array($b->status, array('nou', 'in-lucru', 'planificat', 'rezolvat', 'respins'), true)) np_send(array('error' => 'invalid status'), 400);
        $found = false;
        np_update('feedback.json', array(), function ($list) use ($b, $id, &$found) {
            $list = is_array($list) ? $list : array();
            foreach ($list as $f) {
                if (!is_object($f) || np_get($f, 'id') !== $id) continue;
                $found = true;
                if (!empty($b->status)) $f->status = $b->status;
                if (property_exists($b, 'reply')) $f->reply = np_clip($b->reply, 1000);
            }
            return $list;
        });
        if ($found) np_send(array('ok' => true));
        np_send(array('error' => 'not found'), 404);

    /* Setup status for the "Primii pași" checklist (never the secrets themselves). */
    case 'GET info':
        $fleet = np_read('fleet.json', null);
        $institutions = np_read('institutions.json', null);
        $feedback = np_read('feedback.json', array());
        $feedback = is_array($feedback) ? $feedback : array();
        $open = 0;
        foreach ($feedback as $f) if (in_array(np_get($f, 'status'), array('nou', 'in-lucru'), true)) $open++;
        $fixes = array_values((array) np_read('gps-latest.json', new stdClass()));
        $dayAgo = np_now() - 24 * 3600000;
        np_send(array(
            'version' => NP_VERSION,
            'node' => 'PHP ' . PHP_VERSION,
            'hosting' => 'web',
            'uptimeMin' => 0,
            'data' => array('writable' => np_writable()),
            'auth' => array('office' => np_code('office') !== '', 'driver' => np_code('driver') !== '', 'gpsToken' => np_cfg('cheie_gps') !== ''),
            'warehouseSet' => (bool) np_get(np_read('settings.json', null), 'warehouse'),
            'fleetSaved' => is_array($fleet) && count($fleet) > 0,
            'fleetCount' => is_array($fleet) ? count($fleet) : 0,
            'institutions' => is_array($institutions) ? count($institutions) : 0,
            'gps' => array(
                'trackers' => np_count_fixes($fixes, false, null),
                'trackersLastDay' => np_count_fixes($fixes, false, $dayAgo),
                'phonesLastDay' => np_count_fixes($fixes, true, $dayAgo),
            ),
            'confirmations' => array('today' => count(np_read_log('events', np_day())), 'days' => count(np_list_days('events'))),
            'feedback' => array('total' => count($feedback), 'open' => $open),
        ));
}

np_send(array('error' => 'not found'), 404);
