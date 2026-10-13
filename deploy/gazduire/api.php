<?php
/**
 * Nobil Prest · API for the web-hosting version. Same routes and answers as the Node server (src/app/api):
 *   state (GET/PATCH), events (GET/POST), gps (GET/POST), driver/position (POST), feedback (GET/POST/PATCH), info, health.
 * .htaccess sends /api/<route> here as api.php?r=<route>.
 */
declare(strict_types=1);
require __DIR__ . '/np.php';

function send($data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo np_json($data);
    exit;
}

function body()
{
    $v = json_decode((string) file_get_contents('php://input'), false);
    return json_last_error() === JSON_ERROR_NONE ? $v : null;
}

function clip($v, int $n): string
{
    $s = is_scalar($v) ? trim((string) $v) : '';
    return np_cut($s, $n);
}

function is_num($v): bool
{
    return (is_int($v) || is_float($v)) && is_finite((float) $v);
}

function lnglat($v): bool
{
    return is_array($v) && count($v) === 2 && is_num($v[0] ?? null) && is_num($v[1] ?? null);
}

/** Provider-style number: 47.02, "47.02" or "47,02". */
function num($v): ?float
{
    if (is_string($v)) $v = str_replace(',', '.', trim($v));
    return is_numeric($v) && is_finite((float) $v) ? (float) $v : null;
}

function auth_header(): string
{
    foreach (['HTTP_AUTHORIZATION', 'REDIRECT_HTTP_AUTHORIZATION'] as $k) {
        if (!empty($_SERVER[$k])) return (string) $_SERVER[$k];
    }
    if (function_exists('getallheaders')) {
        foreach (getallheaders() as $k => $v) if (strtolower((string) $k) === 'authorization') return (string) $v;
    }
    return '';
}

/** Default tracker IDs of the fleet (from src/lib/seed.ts), written by the package script. */
function default_trackers(): array
{
    $f = __DIR__ . '/np-flota.php';
    return is_file($f) ? (array) require $f : [];
}

/** Stores GPS positions: latest per tracker (gps-latest.json) + the day's history (gps/<day>.ndjson). */
function ingest(array $items, string $source): array
{
    $accepted = 0;
    $rejected = [];
    $log = [];
    foreach (array_slice($items, 0, 5000) as $i => $it) {
        if (!is_object($it)) {
            $rejected[] = $i;
            continue;
        }
        $id = $it->tracker ?? $it->id ?? $it->imei ?? '';
        $tracker = is_scalar($id) ? trim((string) $id) : '';
        $lat = num($it->lat ?? $it->latitude ?? null);
        $lng = num($it->lng ?? $it->lon ?? $it->longitude ?? null);
        $raw = $it->ts ?? null;
        $ts = null;
        if (!$raw) $ts = np_now();
        elseif (is_numeric($raw)) $ts = (int) round((float) $raw < 1e12 ? (float) $raw * 1000 : (float) $raw);
        elseif (is_string($raw)) {
            try {
                $ts = (int) (new DateTime($raw))->format('Uv');
            } catch (Exception $e) {
                $ts = null;
            }
        }
        if ($tracker === '' || $lat === null || $lng === null || abs($lat) > 90 || abs($lng) > 180 || $ts === null) {
            $rejected[] = $i;
            continue;
        }
        $p = ['lat' => $lat, 'lng' => $lng, 'ts' => $ts];
        $speed = num($it->speed ?? null);
        $heading = num($it->heading ?? $it->course ?? null);
        if ($speed !== null) $p['speed'] = $speed;
        if ($heading !== null) $p['heading'] = $heading;
        $p['source'] = $source;
        $log[] = ['tracker' => $tracker] + $p;
        $accepted++;
    }
    if ($log) {
        $byDay = [];
        foreach ($log as $p) $byDay[np_day($p['ts'])][] = $p;
        foreach ($byDay as $day => $list) np_append('gps', $day, $list);
        np_update('gps-latest.json', new stdClass(), function ($latest) use ($log) {
            if (!is_object($latest)) $latest = new stdClass();
            foreach ($log as $p) {
                $t = $p['tracker'];
                $prev = $latest->{$t} ?? null;
                if (!$prev || ($prev->ts ?? 0) <= $p['ts']) {
                    unset($p['tracker']);
                    $latest->{$t} = (object) $p;
                }
            }
            return $latest;
        });
    }
    return ['accepted' => $accepted, 'rejected' => $rejected];
}

$route = trim((string) ($_GET['r'] ?? ''), '/');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// Health check for monitoring: open, shows only the version.
if ($route === 'health') send(['ok' => true, 'version' => NP_VERSION]);

// Access: the GPS provider uses its own key; everyone else the access code (cookie set by gate.php).
$role = np_role();
if ($route === 'gps' && $method === 'POST' && np_cfg('cheie_gps') !== '') {
    $key = np_cfg('cheie_gps');
    if (!hash_equals("Bearer $key", auth_header()) && !hash_equals($key, (string) ($_GET['token'] ?? ''))) send(['error' => 'unauthorized'], 401);
} elseif ($role === null) {
    send(['error' => 'Introduceți codul de acces.'], 401);
} elseif ($role === 'driver') {
    // Drivers: their page's calls, reading the plan and sending suggestions.
    $ok = $route === 'events' || strpos($route, 'driver/') === 0 || ($route === 'state' && $method === 'GET') || ($route === 'feedback' && $method === 'POST');
    if (!$ok) send(['error' => 'Acces doar la pagina Șofer'], 403);
}

switch ("$method $route") {
    /* Shared settings: imported institutions, warehouse location, fleet cards. */
    case 'GET state':
        $settings = np_read('settings.json', null);
        send([
            'institutions' => np_read('institutions.json', null),
            'warehouse' => is_object($settings) ? ($settings->warehouse ?? null) : null,
            'fleet' => np_read('fleet.json', null),
        ]);

    case 'PATCH state':
        $b = body();
        if (!is_object($b)) send(['error' => 'invalid JSON'], 400);
        $writes = [];
        if (property_exists($b, 'institutions')) {
            $v = $b->institutions;
            $ok = $v === null || (is_array($v) && count($v) <= 20000 && array_reduce($v, fn($a, $i) => $a && is_object($i) && is_string($i->id ?? null) && is_string($i->name ?? null) && lnglat($i->pos ?? null), true));
            if (!$ok) send(['error' => 'invalid institutions'], 400);
            $writes['institutions.json'] = $v;
        }
        if (property_exists($b, 'warehouse')) {
            if ($b->warehouse !== null && !lnglat($b->warehouse)) send(['error' => 'invalid warehouse'], 400);
            $writes['settings.json'] = ['warehouse' => $b->warehouse];
        }
        if (property_exists($b, 'fleet')) {
            $v = $b->fleet;
            $ok = $v === null || (is_array($v) && count($v) <= 100 && array_reduce($v, fn($a, $t) => $a && is_object($t) && is_int($t->number ?? null) && $t->number > 0 && is_string($t->plate ?? null) && is_num($t->capacityKg ?? null), true));
            if (!$ok) send(['error' => 'invalid fleet'], 400);
            $writes['fleet.json'] = $v;
        }
        foreach ($writes as $name => $v) np_write($name, $v);
        send(['ok' => true]);

    /* Delivery confirmations from drivers. */
    case 'POST events':
        $b = body();
        $statuses = ['arrived', 'delivered', 'problem'];
        $truck = is_object($b) ? ($b->truck ?? null) : null;
        $truckOk = is_int($truck) || (is_string($truck) && preg_match('/^\s*-?\d+\s*$/', $truck)) || (is_float($truck) && floor($truck) === $truck);
        if (!is_object($b) || !is_string($b->orderNo ?? null) || $b->orderNo === '' || !in_array($b->status ?? null, $statuses, true) || !$truckOk) {
            send(['error' => 'orderNo, truck and status are required'], 400);
        }
        $c = ['orderNo' => np_cut($b->orderNo, 64), 'truck' => (int) $truck, 'status' => $b->status];
        if (!empty($b->reason)) $c['reason'] = np_cut(is_scalar($b->reason) ? (string) $b->reason : '', 200);
        $c['ts'] = np_now();
        np_append('events', np_day($c['ts']), [$c]);
        send(['ok' => true, 'confirmation' => $c]);

    case 'GET events':
        $day = np_is_day($_GET['day'] ?? null) ? $_GET['day'] : np_day();
        $latest = new stdClass();
        foreach (np_read_log('events', $day) as $c) if (isset($c->orderNo)) $latest->{$c->orderNo} = $c;
        send(['day' => $day, 'confirmations' => $latest]);

    /* GPS positions: from the provider (POST) and for the map (GET). */
    case 'POST gps':
        $b = body();
        if ($b === null && trim((string) file_get_contents('php://input')) !== 'null') send(['error' => 'invalid JSON'], 400);
        send(ingest(is_array($b) ? $b : [$b], 'tracker'));

    case 'GET gps':
        $tracker = $_GET['tracker'] ?? null;
        if (is_string($tracker) && $tracker !== '') {
            $day = np_is_day($_GET['day'] ?? null) ? $_GET['day'] : np_day();
            $points = array_values(array_filter(np_read_log('gps', $day), fn($p) => (string) ($p->tracker ?? '') === $tracker));
            send(['tracker' => $tracker, 'day' => $day, 'points' => $points]);
        }
        $latest = np_read('gps-latest.json', new stdClass());
        send(['positions' => is_object($latest) ? $latest : new stdClass(), 'serverTime' => np_now()]);

    /* Position from a driver's phone, for trucks whose tracker doesn't report. */
    case 'POST driver/position':
        $b = body();
        $n = is_object($b) && is_numeric($b->truck ?? null) ? (float) $b->truck : 0;
        if (!is_object($b) || floor($n) !== $n || $n < 1) send(['error' => 'truck required'], 400);
        $n = (int) $n;
        $fleet = np_read('fleet.json', null);
        $tracker = '';
        if (is_array($fleet)) {
            foreach ($fleet as $f) {
                if (is_object($f) && ($f->number ?? null) === $n) {
                    $tracker = (string) ($f->trackerId ?? '');
                    break;
                }
            }
        } else {
            $tracker = (string) (default_trackers()[$n] ?? '');
        }
        $pos = (object) ['tracker' => $tracker !== '' ? $tracker : "T$n", 'lat' => $b->lat ?? null, 'lng' => $b->lng ?? null, 'speed' => $b->speed ?? null, 'heading' => $b->heading ?? null];
        send(ingest([$pos], 'phone'));

    /* Suggestions, problems and questions (Ghid → Propuneri). */
    case 'GET feedback':
        $items = np_read('feedback.json', []);
        $items = is_array($items) ? $items : [];
        usort($items, fn($a, $b) => ($b->ts ?? 0) <=> ($a->ts ?? 0));
        send(['items' => $items]);

    case 'POST feedback':
        $b = body();
        $text = clip(is_object($b) ? ($b->text ?? '') : '', 4000);
        if (!is_object($b) || np_len($text) < 3) send(['error' => 'Scrieți descrierea (minim 3 caractere).'], 400);
        $page = clip($b->page ?? '', 60) ?: 'General';
        $item = [
            'id' => 'F' . base_convert((string) np_now(), 10, 36) . substr(base_convert(bin2hex(random_bytes(4)), 16, 36), 0, 4),
            'ts' => np_now(),
            'name' => clip($b->name ?? '', 80) ?: 'Anonim',
            'kind' => in_array($b->kind ?? null, ['problema', 'propunere', 'intrebare'], true) ? $b->kind : 'propunere',
            'page' => $page,
            'text' => $text,
            'priority' => in_array($b->priority ?? null, ['mica', 'medie', 'mare'], true) ? $b->priority : 'medie',
            'status' => 'nou',
            'version' => NP_VERSION,
            'from' => $role === 'driver' || $page === 'Șofer' ? 'sofer' : 'birou',
        ];
        np_update('feedback.json', [], fn($list) => array_slice(array_merge(is_array($list) ? $list : [], [$item]), -2000));
        send(['ok' => true, 'item' => $item]);

    case 'PATCH feedback':
        $b = body();
        if (!is_object($b) || !is_string($b->id ?? null) || $b->id === '') send(['error' => 'id required'], 400);
        $statuses = ['nou', 'in-lucru', 'planificat', 'rezolvat', 'respins'];
        if (property_exists($b, 'status') && !in_array($b->status, $statuses, true)) send(['error' => 'invalid status'], 400);
        $found = false;
        np_update('feedback.json', [], function ($list) use ($b, &$found) {
            foreach (is_array($list) ? $list : [] as $f) {
                if (!is_object($f) || ($f->id ?? null) !== $b->id) continue;
                $found = true;
                if (!empty($b->status)) $f->status = $b->status;
                if (property_exists($b, 'reply')) $f->reply = clip($b->reply, 1000);
            }
            return is_array($list) ? $list : [];
        });
        $found ? send(['ok' => true]) : send(['error' => 'not found'], 404);

    /* Setup status for the "Primii pași" checklist (never the secrets themselves). */
    case 'GET info':
        $settings = np_read('settings.json', null);
        $fleet = np_read('fleet.json', null);
        $institutions = np_read('institutions.json', null);
        $feedback = np_read('feedback.json', []);
        $feedback = is_array($feedback) ? $feedback : [];
        $fixes = array_values((array) np_read('gps-latest.json', new stdClass()));
        $dayAgo = np_now() - 24 * 3600000;
        $count = fn(callable $f) => count(array_filter($fixes, fn($p) => is_object($p) && $f($p)));
        send([
            'version' => NP_VERSION,
            'node' => 'PHP ' . PHP_VERSION,
            'hosting' => 'web',
            'uptimeMin' => 0,
            'data' => ['writable' => np_writable()],
            'auth' => ['office' => np_code('office') !== '', 'driver' => np_code('driver') !== '', 'gpsToken' => np_cfg('cheie_gps') !== ''],
            'warehouseSet' => is_object($settings) && !empty($settings->warehouse),
            'fleetSaved' => is_array($fleet) && count($fleet) > 0,
            'fleetCount' => is_array($fleet) ? count($fleet) : 0,
            'institutions' => is_array($institutions) ? count($institutions) : 0,
            'gps' => [
                'trackers' => $count(fn($p) => ($p->source ?? '') !== 'phone'),
                'trackersLastDay' => $count(fn($p) => ($p->source ?? '') !== 'phone' && ($p->ts ?? 0) > $dayAgo),
                'phonesLastDay' => $count(fn($p) => ($p->source ?? '') === 'phone' && ($p->ts ?? 0) > $dayAgo),
            ],
            'confirmations' => ['today' => count(np_read_log('events', np_day())), 'days' => count(np_list_days('events'))],
            'feedback' => ['total' => count($feedback), 'open' => count(array_filter($feedback, fn($f) => in_array($f->status ?? '', ['nou', 'in-lucru'], true)))],
        ]);
}

send(['error' => 'not found'], 404);
