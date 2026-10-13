<?php
/*
 * Nobil Prest · installation check for the web-hosting version: https://domeniu/delivery/verificare.php
 * Open without the access code. Written in the oldest PHP syntax so it opens on any PHP version
 * and can say what is missing. Shows no codes or keys. It can be deleted once everything works.
 */
@ini_set('display_errors', '0');
$dir = dirname(__FILE__);
$rows = array();

function np_row(&$rows, $ok, $title, $detail)
{
    $rows[] = array($ok, $title, $detail);
}

$v = PHP_VERSION;
$modern = version_compare($v, '5.4.0', '>=');
np_row($rows, $modern, 'Versiunea PHP: ' . $v, $modern
    ? 'Potrivită.'
    : 'Prea veche. În cPanel deschideți „Select PHP Version” (sau „MultiPHP Manager”), alegeți 8.1 sau mai nou pentru acest domeniu și apăsați Apply / Set as current.');
np_row($rows, function_exists('json_encode'), 'Extensia JSON', function_exists('json_encode')
    ? 'Activă.'
    : 'Lipsește. În „Select PHP Version” → Extensions bifați „json”.');
np_row($rows, true, 'Extensia mbstring (opțional)', function_exists('mb_substr') ? 'Activă.' : 'Lipsește, dar aplicația merge și fără ea.');

$files = array('.htaccess', 'gate.php', 'api.php', 'np.php', 'config.php', 'index.html', 'sofer/index.html');
$missing = array();
foreach ($files as $f) if (!is_file($dir . '/' . $f)) $missing[] = $f;
np_row($rows, !$missing, 'Fișierele aplicației', $missing
    ? 'Lipsesc: ' . implode(', ', $missing) . '. Dezarhivați din nou arhiva în folderul domeniului.'
    : 'Toate sunt la locul lor.');

$codeSet = false;
if (is_file($dir . '/config.php')) {
    $cfg = include $dir . '/config.php';
    $codeSet = is_array($cfg) && isset($cfg['cod_birou']) && trim($cfg['cod_birou']) !== '';
}
np_row($rows, $codeSet, 'Codul de acces', $codeSet
    ? 'Este setat în config.php.'
    : 'Nu este setat: oricine are adresa poate intra. Completați cod_birou în config.php.');

if ($modern && function_exists('json_encode') && !$missing) {
    include $dir . '/np.php';
    $data = np_data_dir();
    $home = dirname(dirname($dir));
    $shown = strpos($data, $home) === 0 ? '~' . substr($data, strlen($home)) : $data;
    $writable = np_writable();
    np_row($rows, $writable, 'Folderul de date: ' . $shown, $writable
        ? (strpos($data, $dir) === 0 ? 'Se poate scrie. Este în folderul aplicației, protejat de .htaccess.' : 'Se poate scrie. Este în afara site-ului (nu se poate deschide din internet).')
        : 'Nu se poate scrie. În File Manager dați permisiunea 755 folderului de mai sus sau scrieți altă cale în config.php → date.');
}

$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (isset($_SERVER['SERVER_PORT']) && $_SERVER['SERVER_PORT'] == 443);
np_row($rows, $https ? true : null, 'Adresă sigură (https)', $https
    ? 'Da.'
    : 'Nu. Aplicația merge, dar telefoanele șoferilor nu pot trimite poziția GPS. În cPanel: „SSL/TLS Status” → Run AutoSSL (sau certificatul gratuit din panoul furnizorului).');

$errors = '';
if (is_file($dir . '/error_log')) {
    $lines = @file($dir . '/error_log');
    if ($lines) $errors = implode('', array_slice($lines, -8));
}

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
echo '<!doctype html><html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">';
echo '<title>Nobil Prest · Verificare</title><style>';
echo 'body{margin:0;padding:16px;background:#eef2fb;color:#1e293b;font:15px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}';
echo 'main{max-width:680px;margin:0 auto;background:#fff;border-radius:18px;padding:22px;border:1px solid #e2e8f0}';
echo 'h1{font-size:19px;color:#1f3fb3;margin:0 0 4px}p{margin:0 0 14px;color:#64748b;font-size:13px}';
echo 'li{list-style:none;display:flex;gap:10px;padding:10px 0;border-top:1px solid #f1f5f9}ul{padding:0;margin:0}';
echo '.i{flex:none;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;color:#fff;font-size:13px;font-weight:700}';
echo '.ok{background:#10b981}.no{background:#f43f5e}.warn{background:#f59e0b}b{display:block;font-size:14px}span.d{font-size:13px;color:#475569}';
echo 'pre{white-space:pre-wrap;word-break:break-all;background:#0f172a;color:#e2e8f0;padding:12px;border-radius:12px;font-size:12px}';
echo 'a.btn{display:inline-block;margin-top:16px;background:#1f3fb3;color:#fff;text-decoration:none;padding:10px 16px;border-radius:12px;font-weight:600}';
echo '</style></head><body><main><h1>Nobil Prest · Verificarea instalării</h1><p>Ce merge și ce trebuie reparat pe găzduire.</p><ul>';
$bad = 0;
foreach ($rows as $r) {
    $cls = $r[0] === true ? 'ok' : ($r[0] === null ? 'warn' : 'no');
    if ($r[0] === false) $bad++;
    echo '<li><span class="i ' . $cls . '">' . ($cls === 'ok' ? '✓' : '!') . '</span><div><b>' . htmlspecialchars($r[1]) . '</b><span class="d">' . htmlspecialchars($r[2]) . '</span></div></li>';
}
echo '</ul>';
echo '<p style="margin-top:14px">Test API: <a href="api/health">api/health</a> trebuie să arate <code>{"ok":true,...}</code>. Dacă arată o eroare 404, regulile din .htaccess nu sunt citite.</p>';
if ($errors !== '') echo '<p><b>Ultimele erori PHP (fișierul error_log):</b></p><pre>' . htmlspecialchars($errors) . '</pre>';
echo $bad ? '<p><b>Reparați punctele roșii, apoi reîncărcați pagina.</b></p>' : '<a class="btn" href="./">Deschide aplicația</a>';
echo '</main></body></html>';
