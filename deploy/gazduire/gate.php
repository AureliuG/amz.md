<?php
/**
 * Nobil Prest · every page of the web-hosting version comes through here (see .htaccess):
 * without the access code it shows the login page; with it, it serves the app's files.
 * Drivers with their own code (cod_sofer) only get the Șofer page.
 */
declare(strict_types=1);
require __DIR__ . '/np.php';

const TYPES = [
    'html' => 'text/html; charset=utf-8', 'txt' => 'text/plain; charset=utf-8', 'js' => 'text/javascript; charset=utf-8',
    'css' => 'text/css; charset=utf-8', 'svg' => 'image/svg+xml', 'png' => 'image/png', 'jpg' => 'image/jpeg', 'ico' => 'image/x-icon',
    'webp' => 'image/webp', 'woff2' => 'font/woff2', 'webmanifest' => 'application/manifest+json',
];

$base = np_base();
$uri = (string) ($_SERVER['REQUEST_URI'] ?? '/');
$path = rawurldecode((string) parse_url($uri, PHP_URL_PATH));
$query = (string) parse_url($uri, PHP_URL_QUERY);
$rel = strpos($path, $base) === 0 ? substr($path, strlen($base)) : '/';
if ($rel === '') redirect("$base/");

if (isset($_GET['iesire'])) {
    np_set_cookie('');
    redirect("$base/");
}

$role = np_role();
if ($role === null) login($base);
if ($role === 'driver' && !preg_match('#^/(sofer(/|$)|_next/|icon\.svg$|manifest\.webmanifest$)#', $rel)) redirect("$base/sofer/");

serve($rel, $base, $query);

function redirect(string $to, int $status = 302): void
{
    header("Location: $to", true, $status);
    exit;
}

function serve(string $rel, string $base, string $query): void
{
    $bad = strpos($rel, "\0") !== false || preg_match('#(^|/)\.|(^|/)date(/|$)#', $rel);
    $file = __DIR__ . $rel;
    if (!$bad && substr($rel, -1) !== '/' && is_dir($file)) redirect($base . $rel . '/' . ($query !== '' ? "?$query" : ''), 301);
    if (substr($rel, -1) === '/') $file .= 'index.html';
    $real = realpath($file);
    $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
    $root = realpath(__DIR__);
    if ($bad || !$real || !$root || strpos($real, $root . DIRECTORY_SEPARATOR) !== 0 || !is_file($real) || !isset(TYPES[$ext])) {
        $real = is_file(__DIR__ . '/404.html') ? __DIR__ . '/404.html' : null;
        $ext = 'html';
        http_response_code(404);
        if (!$real) {
            echo 'Pagina nu există.';
            exit;
        }
    }
    header('Content-Type: ' . TYPES[$ext]);
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: ' . ($ext === 'html' || $ext === 'txt' ? 'no-cache, private' : 'private, max-age=86400'));
    $data = (string) file_get_contents($real);
    $gzip = strpos((string) ($_SERVER['HTTP_ACCEPT_ENCODING'] ?? ''), 'gzip') !== false && strlen($data) > 1024 && strpos(TYPES[$ext], 'image/') !== 0 && !ini_get('zlib.output_compression') && function_exists('gzencode');
    if ($gzip) {
        $data = (string) gzencode($data, 6);
        header('Content-Encoding: gzip');
        header('Vary: Accept-Encoding');
    }
    header('Content-Length: ' . strlen($data));
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'HEAD') echo $data;
    exit;
}

/** The access-code page (and checking the code when it is sent). */
function login(string $base): void
{
    $error = '';
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' && isset($_POST['cod'])) {
        $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
        if (np_throttled($ip)) {
            $error = 'Prea multe încercări greșite. Așteptați 15 minute.';
        } elseif ($role = np_check_code($_POST['cod'])) {
            np_set_cookie(np_key($role));
            redirect($role === 'driver' ? "$base/sofer/" : (string) ($_SERVER['REQUEST_URI'] ?? "$base/"), 303);
        } else {
            np_fail($ip);
            sleep(1);
            $error = 'Cod greșit. Încercați din nou.';
        }
    }
    http_response_code(401);
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    $v = htmlspecialchars(preg_replace('/^(\d+\.\d+)\.0$/', '$1', NP_VERSION) ?? NP_VERSION);
    $e = htmlspecialchars($error);
    $icon = htmlspecialchars("$base/icon.svg");
    echo <<<HTML
<!doctype html>
<html lang="ro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Nobil Prest · Intrare</title>
<link rel="icon" href="$icon">
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px; background: #eef2fb; color: #1e293b;
    font: 15px/1.45 Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { width: 100%; max-width: 360px; background: #fff; border-radius: 20px; padding: 28px 24px 22px; box-shadow: 0 10px 30px rgba(31,63,179,.10); border: 1px solid #e2e8f0; }
  .brand { display: flex; align-items: center; gap: 12px; margin-bottom: 22px; }
  .brand img { width: 44px; height: 44px; border-radius: 12px; }
  .brand b { display: block; font-size: 18px; color: #1f3fb3; }
  .brand span { font-size: 13px; color: #64748b; }
  label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; }
  input { width: 100%; height: 48px; border: 1px solid #cbd5e1; border-radius: 12px; padding: 0 14px; font-size: 20px; letter-spacing: .18em; text-transform: uppercase; outline: none; }
  input:focus { border-color: #1f3fb3; box-shadow: 0 0 0 3px rgba(31,63,179,.15); }
  button { margin-top: 12px; width: 100%; height: 48px; border: 0; border-radius: 12px; background: #1f3fb3; color: #fff; font-size: 16px; font-weight: 600; cursor: pointer; }
  button:hover { background: #1a3596; }
  .err { margin: 10px 0 0; color: #e11d48; font-size: 13px; }
  .note { margin: 16px 0 0; font-size: 12px; color: #64748b; }
  .ver { margin-top: 14px; font-size: 11px; color: #94a3b8; text-align: center; }
</style>
</head>
<body>
<main>
  <div class="brand"><img src="$icon" alt=""><div><b>Nobil Prest</b><span>Depozit &amp; livrări</span></div></div>
  <form method="post">
    <label for="cod">Cod de acces</label>
    <input id="cod" name="cod" autocomplete="current-password" autocapitalize="characters" autocorrect="off" spellcheck="false" autofocus required>
    <button type="submit">Intră</button>
    <p class="err" role="alert">$e</p>
  </form>
  <p class="note">Codul îl primiți de la birou. Calculatorul sau telefonul îl ține minte, nu trebuie introdus din nou.</p>
  <div class="ver">versiunea $v</div>
</main>
</body>
</html>
HTML;
    exit;
}
