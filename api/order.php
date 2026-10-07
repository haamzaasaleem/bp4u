<?php
/**
 * Design Studio order endpoint (for PHP hosting such as Hostinger).
 *
 * Receives the production package (zip) from design.html, stores it in
 * ../orders-private/ and emails the shop. Enable it by setting
 * orderEndpoint: "api/order.php" in js/config.js.
 */

// ---- settings -------------------------------------------------------------
const SHOP_EMAIL   = 'scrabb@crabbdigitalmedia.com';
const FROM_EMAIL   = 'orders@businessprinting4u.com';   // use an address on your domain
const MAX_BYTES    = 40 * 1024 * 1024;                   // 40 MB
const ATTACH_LIMIT = 15 * 1024 * 1024;                   // attach zip to email if under 15 MB
$storeDir = dirname(__DIR__) . '/orders-private';        // keep outside public access if possible
// ---------------------------------------------------------------------------

header('Content-Type: application/json');

function fail($code, $msg) {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405, 'POST only');
if (!empty($_POST['website'])) fail(400, 'Rejected');                       // honeypot

$name  = trim(strip_tags($_POST['name'] ?? ''));
$email = filter_var(trim($_POST['email'] ?? ''), FILTER_VALIDATE_EMAIL);
$phone = trim(strip_tags($_POST['phone'] ?? ''));
if ($name === '' || !$email) fail(400, 'Name and a valid email are required');

$order = json_decode($_POST['order'] ?? '', true);
if (!is_array($order) || empty($order['orderId'])) fail(400, 'Missing order details');
$orderId = preg_replace('/[^A-Z0-9-]/', '', strtoupper($order['orderId']));

$file = $_FILES['package'] ?? null;
if (!$file || $file['error'] !== UPLOAD_ERR_OK) fail(400, 'Upload failed');
if ($file['size'] > MAX_BYTES) fail(413, 'File too large');
$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = $finfo->file($file['tmp_name']);
if (!in_array($mime, ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'], true)) fail(400, 'Invalid file');

if (!is_dir($storeDir) && !mkdir($storeDir, 0750, true)) fail(500, 'Storage unavailable');
if (!file_exists($storeDir . '/.htaccess')) file_put_contents($storeDir . '/.htaccess', "Require all denied\n");
$slug = trim(preg_replace('/[^a-z0-9]+/', '-', strtolower($name)), '-') ?: 'customer';
$dest = $storeDir . '/' . $orderId . '-' . $slug . '.zip';
if (!move_uploaded_file($file['tmp_name'], $dest)) fail(500, 'Could not save file');
file_put_contents($storeDir . '/' . $orderId . '.json', json_encode($order, JSON_PRETTY_PRINT));

// ---- email the shop -----------------------------------------------------------
$p = $order['product'] ?? [];
$lines = [
    "New Design Studio order: $orderId",
    "",
    "Customer: $name",
    "Email:    $email",
    "Phone:    $phone",
    "Org:      " . ($order['customer']['organization'] ?? ''),
    "Need by:  " . ($order['customer']['neededBy'] ?? ''),
    "",
    "Product:  " . ($p['name'] ?? '') . " / " . ($p['color'] ?? ''),
    "Method:   " . ($order['decoration'] ?? ''),
    "Pieces:   " . ($order['totalPieces'] ?? ''),
    "Estimate: $" . number_format((float)($order['estimate']['total'] ?? 0), 2),
    "",
    "Notes: " . ($order['customer']['notes'] ?? ''),
    "",
    "Saved on server: " . basename($dest),
];
$body = implode("\r\n", $lines);
$subject = "New order $orderId from $name";
$boundary = 'bp4u-' . bin2hex(random_bytes(8));
$headers = "From: Business Printing 4 U <" . FROM_EMAIL . ">\r\nReply-To: $email\r\nMIME-Version: 1.0\r\n";

if (filesize($dest) <= ATTACH_LIMIT) {
    $headers .= "Content-Type: multipart/mixed; boundary=\"$boundary\"";
    $msg  = "--$boundary\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n$body\r\n";
    $msg .= "--$boundary\r\nContent-Type: application/zip; name=\"" . basename($dest) . "\"\r\n";
    $msg .= "Content-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename=\"" . basename($dest) . "\"\r\n\r\n";
    $msg .= chunk_split(base64_encode(file_get_contents($dest))) . "\r\n--$boundary--";
} else {
    $headers .= "Content-Type: text/plain; charset=utf-8";
    $msg = $body . "\r\n\r\n(The package is too large to attach. Download it from the server folder orders-private/.)";
}
@mail(SHOP_EMAIL, $subject, $msg, $headers);

// short confirmation to the customer
@mail($email, "We got your design! Order $orderId",
    "Hi $name,\r\n\r\nThanks for designing with Business Printing 4 U! We received order $orderId and will send your free proof and final price within one business day.\r\n\r\nQuestions? Call or text (559) 474-2808.\r\n\r\nShawn & Kimberly",
    "From: Business Printing 4 U <" . FROM_EMAIL . ">\r\nReply-To: " . SHOP_EMAIL);

echo json_encode(['ok' => true, 'orderId' => $orderId]);
