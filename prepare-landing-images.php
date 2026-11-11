<?php
/**
 * Prepare the landing-page images supplied in assets/img/.
 *
 * Cover-crops each source image to the size the layout needs, lightly
 * compresses it, and writes cleanly-named files to assets/img/landing/.
 *
 * Usage: php prepare-landing-images.php
 */
declare(strict_types=1);

$root = __DIR__;
$srcDir = $root . '/assets/img';
$outDir = $srcDir . '/landing';
if (!is_dir($outDir) && !mkdir($outDir, 0775, true) && !is_dir($outDir)) {
    fwrite(STDERR, "Cannot create {$outDir}\n");
    exit(1);
}

$jobs = [
    // source, target, width, height
    ['Hero Background Desktop.jpg',       'hero-desktop.jpg',       1920,  960],
    ['Hero Background Mobile.jpg',        'hero-mobile.jpg',        1080, 1350],

    ['Category Beverages.jpg',            'cat-beverages.jpg',       800,  800],
    ['OG_Cover.jpg',                      'cat-pantry.jpg',          800,  800],
    ['Promo banner Snacks.jpg',           'cat-snacks.jpg',          800,  800],
    ['Category Health & Beauty.jpg',      'cat-health-beauty.jpg',   800,  800],
    ['Category Home & Household.jpg',     'cat-home.jpg',            800,  800],

    ['Promo banner Snacks.jpg',           'banner-snacks.jpg',      1200,  675],
    ['Promo banner Drink.jpg',            'banner-drinks.jpg',      1200,  675],
    ['Promo banner Home.jpg',             'banner-home.jpg',        1200,  675],

    ['Country Life Nigeria.jpg',          'country-nigeria.jpg',     800, 1067],
    ['Country Life Ghana.jpg',            'country-ghana.jpg',       800, 1067],
    ['Country Life Jamaica.jpg',          'country-jamaica.jpg',     800, 1067],
    ['Country Life South Africa.jpg',     'country-south-africa.jpg',800, 1067],

    ['OG_Cover.jpg',                      'og-cover.jpg',           1200,  630],
    ['wholesale.jpg',                     'wholesale.jpg',          1200,  675],
    ['delivery.jpg',                      'delivery.jpg',           1200,  675],
];

function cover(string $file, int $tw, int $th): ?GdImage
{
    $bytes = @file_get_contents($file);
    if ($bytes === false) return null;
    $src = @imagecreatefromstring($bytes);
    if ($src === false) return null;

    $sw = imagesx($src); $sh = imagesy($src);
    $scale = max($tw / $sw, $th / $sh);
    $nw = (int) ceil($sw * $scale);
    $nh = (int) ceil($sh * $scale);
    $dx = (int) floor(($nw - $tw) / 2);
    $dy = (int) floor(($nh - $th) / 2);

    $canvas = imagecreatetruecolor($tw, $th);
    imagecopyresampled($canvas, $src, -$dx, -$dy, 0, 0, $nw, $nh, $sw, $sh);
    imagedestroy($src);
    return $canvas;
}

$ok = 0; $fail = 0;
foreach ($jobs as [$src, $target, $w, $h]) {
    $path = $srcDir . '/' . $src;
    if (!is_file($path)) { echo "✗ missing {$src}\n"; $fail++; continue; }
    $im = cover($path, $w, $h);
    if ($im === null) { echo "✗ cannot decode {$src}\n"; $fail++; continue; }
    imagejpeg($im, $outDir . '/' . $target, 82);
    imagedestroy($im);
    $kb = round(filesize($outDir . '/' . $target) / 1024);
    echo "✓ {$target} ({$w}×{$h}, {$kb} KB)\n";
    $ok++;
}
echo "\nDone: {$ok} written, {$fail} failed → assets/img/landing/\n";
