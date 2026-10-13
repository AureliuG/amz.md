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


/* ---------- orders, plans, stock (same checks as src/lib/server/validate.ts) ---------- */

function np_qty($q)
{
    $q = round($q * 1000) / 1000;
    return floor($q) == $q && abs($q) < 1e15 ? (int) $q : $q;
}

/** Order or stock lines: 1–300 products with a positive quantity (zero allowed for inventory). */
function np_clean_lines($v, $allowZero = false)
{
    if (!is_array($v) || count($v) < 1 || count($v) > 300) return null;
    $out = array();
    foreach ($v as $l) {
        $id = np_get($l, 'productId');
        $q = np_get($l, 'qty');
        if (!is_string($id) || $id === '' || !np_is_num($q) || $q < 0 || (!$allowZero && $q == 0) || $q > 1e6) return null;
        $out[] = array('productId' => substr($id, 0, 64), 'qty' => np_qty($q));
    }
    return $out;
}

function np_clean_order($b)
{
    $inst = np_get($b, 'institutionId');
    $date = np_get($b, 'date');
    if (!is_object($b) || !is_string($inst) || $inst === '' || !np_is_day($date)) return null;
    $lines = np_clean_lines(np_get($b, 'lines'));
    if ($lines === null) return null;
    $o = array('institutionId' => substr($inst, 0, 64), 'date' => $date, 'lines' => $lines);
    $note = np_clip(np_get($b, 'note'), 500);
    if ($note !== '') $o['note'] = $note;
    $o['source'] = in_array(np_get($b, 'source'), array('telefon', 'test', '1c'), true) ? $b->source : 'telefon';
    $inv = np_clip(np_get($b, 'invoiceNo'), 40);
    if ($inv !== '') $o['invoiceNo'] = $inv;
    return $o;
}

function np_orders_file($date)
{
    return "orders/$date.json";
}

function np_new_id($prefix)
{
    return $prefix . base_convert((string) np_now(), 10, 36) . substr(base_convert(np_rand_hex(4), 16, 36), 0, 4);
}

/** Reserve `count` consecutive order numbers (CMD-00001…). */
function np_order_numbers($count)
{
    $c = np_update('orders-counter.json', null, function ($cur) use ($count) {
        return array('n' => (int) np_get($cur, 'n', 0) + $count);
    });
    $out = array();
    for ($i = 0; $i < $count; $i++) $out[] = 'CMD-' . str_pad((string) ($c['n'] - $count + 1 + $i), 5, '0', STR_PAD_LEFT);
    return $out;
}

/** An order with its fields in the same order as the Node server (id, no, …, status, createdAt). */
function np_order_record($id, $no, $input, $status, $createdAt)
{
    return array_merge(array('id' => $id, 'no' => $no), $input, array('status' => $status, 'createdAt' => $createdAt));
}

function np_list($v)
{
    return is_array($v) ? $v : array();
}

function np_clean_plan($p, $date)
{
    $routesIn = np_get($p, 'routes');
    if (!is_object($p) || !is_array($routesIn) || count($routesIn) > 100) return null;
    $routes = array();
    foreach ($routesIn as $r) {
        $truck = np_get($r, 'truck');
        $ids = np_get($r, 'orderIds');
        if (!is_int($truck) || $truck < 1 || !is_array($ids) || count($ids) > 500) return null;
        $clean = array();
        foreach ($ids as $x) {
            if (!is_string($x)) return null;
            $clean[] = substr($x, 0, 64);
        }
        $routes[] = array('truck' => $truck, 'orderIds' => $clean);
    }
    $loaded = new stdClass();
    foreach ((array) np_get($p, 'loaded', array()) as $k => $ts) {
        if (preg_match('/^\d+$/', (string) $k) && np_is_num($ts)) $loaded->$k = $ts;
    }
    return array('date' => $date, 'routes' => $routes, 'approved' => (bool) np_get($p, 'approved', false), 'loaded' => $loaded, 'updatedAt' => np_now());
}

function np_clean_move($m)
{
    $type = np_get($m, 'type');
    if (!in_array($type, array('intrare', 'iesire', 'corectie'), true)) return null;
    $lines = np_clean_lines(np_get($m, 'lines'), $type === 'corectie');
    if ($lines === null) return null;
    $out = array('type' => $type, 'lines' => $lines);
    $note = np_clip(np_get($m, 'note'), 300);
    if ($note !== '') $out['note'] = $note;
    $ref = np_clip(np_get($m, 'ref'), 80);
    if ($ref !== '') $out['ref'] = $ref;
    return $out;
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
    $ok = $route === 'events' || strpos($route, 'driver/') === 0 || ($method === 'GET' && in_array($route, array('state', 'orders', 'plan'), true)) || ($route === 'feedback' && $method === 'POST');
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

    /* Orders (Comenzi), one file per delivery day. Only GET and POST: some hosts block PUT/DELETE. */
    case 'GET orders':
        $day = np_is_day(np_get($_GET, 'date')) ? $_GET['date'] : np_day();
        np_send(array('date' => $day, 'orders' => np_list(np_read(np_orders_file($day), array()))));

    case 'POST orders':
        $b = np_body();
        if (!is_object($b)) np_send(array('error' => 'invalid JSON'), 400);
        $action = np_get($b, 'action');
        if ($action === 'create') {
            $input = np_clean_order(np_get($b, 'order'));
            if (!$input) np_send(array('error' => 'Comanda nu este completă (instituția, data și cel puțin un produs).'), 400);
            $nos = np_order_numbers(1);
            $order = np_order_record(np_new_id('O'), $nos[0], $input, 'noua', np_now());
            np_update(np_orders_file($input['date']), array(), function ($list) use ($order) {
                $list = np_list($list);
                $list[] = $order;
                return $list;
            });
            np_send(array('ok' => true, 'order' => $order));
        }
        if ($action === 'bulk') {
            $raw = np_get($b, 'orders');
            $list = array();
            foreach (is_array($raw) ? array_slice($raw, 0, 1500) : array() as $o) {
                $c = np_clean_order($o);
                if (!$c) np_send(array('error' => 'invalid orders'), 400);
                $list[] = $c;
            }
            if (!$list) np_send(array('error' => 'invalid orders'), 400);
            $nos = np_order_numbers(count($list));
            $now = np_now();
            $byDate = array();
            foreach ($list as $i => $c) $byDate[$c['date']][] = np_order_record(np_new_id('O') . $i, $nos[$i], $c, 'noua', $now);
            foreach ($byDate as $date => $add) {
                np_update(np_orders_file($date), array(), function ($cur) use ($add) {
                    return array_merge(np_list($cur), $add);
                });
            }
            np_send(array('ok' => true, 'created' => count($list)));
        }
        if ($action === 'update') {
            $id = np_clip(np_get($b, 'id'), 64);
            $date = np_get($b, 'date');
            $patch = np_get($b, 'patch', new stdClass());
            if ($id === '' || !np_is_day($date)) np_send(array('error' => 'id and date required'), 400);
            $lines = property_exists($patch, 'lines') ? np_clean_lines($patch->lines) : false;
            if ($lines === null) np_send(array('error' => 'invalid lines'), 400);
            $status = np_get($patch, 'status');
            if ($status !== null && $status !== 'noua' && $status !== 'anulata') np_send(array('error' => 'invalid status'), 400);
            $newDate = property_exists($patch, 'date') ? $patch->date : $date;
            if (!np_is_day($newDate)) np_send(array('error' => 'invalid date'), 400);
            $found = null;
            np_update(np_orders_file($date), array(), function ($list) use ($id, $patch, $lines, $status, $newDate, $date, &$found) {
                $out = array();
                foreach (np_list($list) as $o) {
                    if (np_get($o, 'id') !== $id) {
                        $out[] = $o;
                        continue;
                    }
                    if ($lines !== false) $o->lines = $lines;
                    if (property_exists($patch, 'note')) {
                        $n = np_clip($patch->note, 500);
                        if ($n === '') unset($o->note);
                        else $o->note = $n;
                    }
                    if ($status !== null) $o->status = $status;
                    if (property_exists($patch, 'invoiceNo')) {
                        $inv = np_clip($patch->invoiceNo, 40);
                        if ($inv === '') unset($o->invoiceNo);
                        else $o->invoiceNo = $inv;
                    }
                    $inst = np_get($patch, 'institutionId');
                    if (is_string($inst) && $inst !== '') $o->institutionId = substr($inst, 0, 64);
                    $o->date = $newDate;
                    $found = $o;
                    if ($newDate === $date) $out[] = $o;
                }
                return $out;
            });
            if (!$found) np_send(array('error' => 'not found'), 404);
            if ($newDate !== $date) {
                np_update(np_orders_file($newDate), array(), function ($list) use ($found) {
                    $list = np_list($list);
                    $list[] = $found;
                    return $list;
                });
            }
            np_send(array('ok' => true, 'order' => $found));
        }
        if ($action === 'delete-test') {
            $date = np_get($b, 'date');
            if (!np_is_day($date)) np_send(array('error' => 'date required'), 400);
            $removed = 0;
            np_update(np_orders_file($date), array(), function ($list) use (&$removed) {
                $keep = array();
                foreach (np_list($list) as $o) {
                    if (np_get($o, 'source') === 'test') $removed++;
                    else $keep[] = $o;
                }
                return $keep;
            });
            np_send(array('ok' => true, 'removed' => $removed));
        }
        np_send(array('error' => 'unknown action'), 400);

    /* Saved routes of a day (null = automatic). */
    case 'GET plan':
        $day = np_is_day(np_get($_GET, 'date')) ? $_GET['date'] : np_day();
        np_send(array('date' => $day, 'plan' => np_read("plans/$day.json", null)));

    case 'POST plan':
        $b = np_body();
        $date = np_get($b, 'date');
        if (!is_object($b) || !np_is_day($date) || !property_exists($b, 'plan')) np_send(array('error' => 'date and plan required'), 400);
        $plan = $b->plan === null ? null : np_clean_plan($b->plan, $date);
        if ($b->plan !== null && !$plan) np_send(array('error' => 'invalid plan'), 400);
        np_write("plans/$date.json", $plan);
        np_send(array('ok' => true, 'plan' => $plan));

    /* Stock levels, movements and the product list. */
    case 'GET stock':
        $stock = np_read('stock.json', null);
        $moves = np_list(np_read('stock-moves.json', array()));
        np_send(array('levels' => np_get($stock, 'levels'), 'products' => np_read('products.json', null), 'moves' => array_reverse(array_slice($moves, -300))));

    case 'POST stock':
        $b = np_body();
        if (!is_object($b)) np_send(array('error' => 'invalid JSON'), 400);
        $action = np_get($b, 'action');
        if ($action === 'move') {
            $m = np_clean_move(np_get($b, 'move'));
            if (!$m) np_send(array('error' => 'invalid move'), 400);
            if (isset($m['ref'])) {
                foreach (np_list(np_read('stock-moves.json', array())) as $x) {
                    if (np_get($x, 'ref') === $m['ref']) np_send(array('ok' => true, 'duplicate' => true));
                }
            }
            $base = array();
            foreach ((array) np_get($b, 'base', array()) as $k => $v) if (np_is_num($v)) $base[substr((string) $k, 0, 64)] = $v;
            $move = array_merge(array('id' => np_new_id('M'), 'ts' => np_now()), $m);
            $next = np_update('stock.json', null, function ($cur) use ($move, $base) {
                $levels = np_get($cur, 'levels');
                $levels = $levels === null ? $base : (array) $levels;
                foreach ($move['lines'] as $l) {
                    $have = isset($levels[$l['productId']]) ? $levels[$l['productId']] : 0;
                    $q = $move['type'] === 'intrare' ? $have + $l['qty'] : ($move['type'] === 'iesire' ? $have - $l['qty'] : $l['qty']);
                    $levels[$l['productId']] = np_qty($q);
                }
                return array('levels' => (object) $levels, 'updatedAt' => np_now());
            });
            np_update('stock-moves.json', array(), function ($list) use ($move) {
                $list = np_list($list);
                $list[] = $move;
                return array_slice($list, -5000);
            });
            np_send(array('ok' => true, 'move' => $move, 'levels' => $next['levels']));
        }
        if ($action === 'products') {
            if (!property_exists($b, 'products')) np_send(array('error' => 'products required'), 400);
            if ($b->products === null) {
                np_write('products.json', null);
                np_send(array('ok' => true));
            }
            $list = np_get($b, 'products');
            if (!is_array($list) || count($list) > 2000) np_send(array('error' => 'invalid products'), 400);
            $out = array();
            foreach ($list as $p) {
                $id = np_clip(np_get($p, 'id'), 64);
                $name = np_clip(np_get($p, 'name'), 120);
                if ($id === '' || $name === '' || !in_array(np_get($p, 'zone'), array('cellar', 'cold', 'dry'), true) || !in_array(np_get($p, 'unit'), array('kg', 'l', 'pcs'), true) || !np_is_num(np_get($p, 'min')) || !np_is_num(np_get($p, 'stock'))) {
                    np_send(array('error' => 'invalid product ' . ($id !== '' ? $id : '?')), 400);
                }
                $color = (string) np_get($p, 'color', '');
                $out[] = array('id' => $id, 'name' => $name, 'zone' => $p->zone, 'unit' => $p->unit, 'min' => $p->min, 'stock' => $p->stock, 'color' => preg_match('/^#[0-9a-f]{6}$/i', $color) ? $color : '#cbd5e1');
            }
            np_write('products.json', $out);
            np_send(array('ok' => true));
        }
        np_send(array('error' => 'unknown action'), 400);

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
            'orders' => array('days' => count(glob(np_data_dir() . '/orders/*.json') ?: array())),
            'feedback' => array('total' => count($feedback), 'open' => $open),
        ));
}

np_send(array('error' => 'not found'), 404);
