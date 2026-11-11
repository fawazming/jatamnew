<?php
/**
 * Download and optimise the product images referenced by products.csv.
 *
 * For every row with an `image_urls` value we fetch the first image that
 * decodes, resize it to fit 640x640, flatten onto white and save it as
 * standalone/assets/img/products/<slug>.jpg. Placeholder artwork is used by
 * the showcase for any product without a usable image.
 *
 * Usage:  php fetch-images.php [--force]
 */
declare(strict_types=1);

$root = __DIR__;
$csvPath = $root . '/../products/products.csv';
$outDir = $root . '/assets/img/products';
$force = in_array('--force', $argv, true);

if (!is_file($csvPath)) {
    fwrite(STDERR, "products.csv not found at {$csvPath}\n");
    exit(1);
}
if (!is_dir($outDir) && !mkdir($outDir, 0775, true) && !is_dir($outDir)) {
    fwrite(STDERR, "Could not create {$outDir}\n");
    exit(1);
}

function fetch(string $url): ?string
{
    $ctx = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => 25,
            'follow_location' => 1,
            'header' => "User-Agent: Mozilla/5.0 (compatible; JatamShowcase/1.0)\r\nAccept: image/*,*/*\r\n",
        ],
        'ssl' => ['verify_peer' => false, 'verify_peer_name' => false],
    ]);
    $data = @file_get_contents($url, false, $ctx);
    return $data === false ? null : $data;
}

function normaliseImage(string $bytes): ?GdImage
{
    $im = @imagecreatefromstring($bytes);
    if ($im === false) {
        return null;
    }
    $w = imagesx($im);
    $h = imagesy($im);
    if ($w < 2 || $h < 2) {
        imagedestroy($im);
        return null;
    }
    $max = 640;
    $scale = min(1, $max / max($w, $h));
    $nw = max(1, (int) round($w * $scale));
    $nh = max(1, (int) round($h * $scale));

    $canvas = imagecreatetruecolor($nw, $nh);
    $white = imagecolorallocate($canvas, 255, 255, 255);
    imagefilledrectangle($canvas, 0, 0, $nw, $nh, $white);
    imagecopyresampled($canvas, $im, 0, 0, 0, 0, $nw, $nh, $w, $h);
    imagedestroy($im);
    return $canvas;
}

$fh = fopen($csvPath, 'r');
$headers = fgetcsv($fh);
$rows = 0;
$saved = 0;
$skipped = 0;
$noimage = 0;
$failed = 0;

while (($line = fgetcsv($fh)) !== false) {
    $rows++;
    $row = array_combine($headers, $line);
    if ($row === false) {
        continue;
    }
    $slug = trim((string) ($row['slug'] ?? ''));
    if ($slug === '') {
        $slug = strtolower(preg_replace('/[^a-z0-9]+/i', '-', (string) ($row['sku'] ?? 'product')));
    }
    $target = $outDir . '/' . $slug . '.jpg';
    if (is_file($target) && !$force) {
        $skipped++;
        continue;
    }

    $urls = array_filter(array_map('trim', explode(',', (string) ($row['image_urls'] ?? ''))));
    if (!$urls) {
        $noimage++;
        continue;
    }

    $stored = false;
    foreach ($urls as $url) {
        if (!preg_match('#^https?://#i', $url)) {
            continue;
        }
        $bytes = fetch($url);
        if ($bytes === null) {
            continue;
        }
        $im = normaliseImage($bytes);
        if ($im === null) {
            continue; // e.g. HEIC that GD cannot decode – try the next URL
        }
        imagejpeg($im, $target, 84);
        imagedestroy($im);
        $stored = true;
        break;
    }

    if ($stored) {
        $saved++;
        echo "✓ {$slug}\n";
    } else {
        $failed++;
        echo "✗ {$slug} (no decodable image)\n";
    }
    flush();
}

fclose($fh);
echo "\nDone: {$rows} rows · {$saved} saved · {$skipped} already present · {$noimage} without image URL · {$failed} failed\n";
echo "Images: {$outDir}\n";
