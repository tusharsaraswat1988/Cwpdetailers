Add-Type -AssemblyName System.Drawing

$baseDir = "D:\cwpdetailersapp"
$androidRes = Join-Path $baseDir "artifacts\cwp-staff-app\android\app\src\main\res"
$pwaDir = Join-Path $baseDir "artifacts\cwp-platform\public\pwa"

$brandBgColor = [System.Drawing.Color]::FromArgb(255, 11, 31, 59) # #0B1F3B

# Load the clean foreground text
$fgSrc = [System.Drawing.Bitmap]::FromFile((Join-Path $baseDir "scratch_fg_clean.png"))

# Bounding box of the white text in scratch_fg_clean.png
$textMinX = 360; $textMaxX = 1635; $textMinY = 820; $textMaxY = 1195
$textWidth = $textMaxX - $textMinX
$textHeight = $textMaxY - $textMinY

function Generate-ForegroundIcon($size) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    # In Android adaptive icons (108dp), safe zone is 72dp (66.6% width)
    # We fit the CWP text inside 62% of the total size for comfortable safe margin
    $targetW = [int]($size * 0.62)
    $targetH = [int]($targetW * ($textHeight / $textWidth))
    $destX = [int](($size - $targetW) / 2)
    $destY = [int](($size - $targetH) / 2)

    $srcRect = New-Object System.Drawing.Rectangle $textMinX, $textMinY, $textWidth, $textHeight
    $destRect = New-Object System.Drawing.Rectangle $destX, $destY, $targetW, $targetH
    $g.DrawImage($fgSrc, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
    $g.Dispose()
    return $bmp
}

function Generate-SquareIcon($size) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    # Rounded rectangle with ~22% corner radius
    $radius = [int]($size * 0.22)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $radius * 2
    $rect = New-Object System.Drawing.Rectangle 0, 0, ($size - 1), ($size - 1)
    $path.AddArc($rect.X, $rect.Y, $d, $d, 180, 90)
    $path.AddArc($rect.Right - $d, $rect.Y, $d, $d, 270, 90)
    $path.AddArc($rect.Right - $d, $rect.Bottom - $d, $d, $d, 0, 90)
    $path.AddArc($rect.X, $rect.Bottom - $d, $d, $d, 90, 90)
    $path.CloseFigure()

    $brush = New-Object System.Drawing.SolidBrush $brandBgColor
    $g.FillPath($brush, $path)
    $brush.Dispose()
    $path.Dispose()

    # Draw centered CWP text (72% of icon width)
    $targetW = [int]($size * 0.72)
    $targetH = [int]($targetW * ($textHeight / $textWidth))
    $destX = [int](($size - $targetW) / 2)
    $destY = [int](($size - $targetH) / 2)

    $srcRect = New-Object System.Drawing.Rectangle $textMinX, $textMinY, $textWidth, $textHeight
    $destRect = New-Object System.Drawing.Rectangle $destX, $destY, $targetW, $targetH
    $g.DrawImage($fgSrc, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
    $g.Dispose()
    return $bmp
}

function Generate-RoundIcon($size) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    # Circle
    $brush = New-Object System.Drawing.SolidBrush $brandBgColor
    $g.FillEllipse($brush, 0, 0, ($size - 1), ($size - 1))
    $brush.Dispose()

    # Draw centered CWP text (64% of icon diameter so it stays within circle boundary)
    $targetW = [int]($size * 0.64)
    $targetH = [int]($targetW * ($textHeight / $textWidth))
    $destX = [int](($size - $targetW) / 2)
    $destY = [int](($size - $targetH) / 2)

    $srcRect = New-Object System.Drawing.Rectangle $textMinX, $textMinY, $textWidth, $textHeight
    $destRect = New-Object System.Drawing.Rectangle $destX, $destY, $targetW, $targetH
    $g.DrawImage($fgSrc, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
    $g.Dispose()
    return $bmp
}

function Generate-Splash($w, $h) {
    $bmp = New-Object System.Drawing.Bitmap $w, $h
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear($brandBgColor)

    # Centered CWP logo mark
    $minDim = [Math]::Min($w, $h)
    $targetW = [int]($minDim * 0.45)
    $targetH = [int]($targetW * ($textHeight / $textWidth))
    $destX = [int](($w - $targetW) / 2)
    $destY = [int](($h - $targetH) / 2)

    $srcRect = New-Object System.Drawing.Rectangle $textMinX, $textMinY, $textWidth, $textHeight
    $destRect = New-Object System.Drawing.Rectangle $destX, $destY, $targetW, $targetH
    $g.DrawImage($fgSrc, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
    $g.Dispose()
    return $bmp
}

# Android densities
$densities = @{
    "mipmap-mdpi"    = @{ icon = 48;  fg = 108 }
    "mipmap-hdpi"    = @{ icon = 72;  fg = 162 }
    "mipmap-xhdpi"   = @{ icon = 96;  fg = 216 }
    "mipmap-xxhdpi"  = @{ icon = 144; fg = 324 }
    "mipmap-xxxhdpi" = @{ icon = 192; fg = 432 }
}

foreach ($d in $densities.Keys) {
    $dir = Join-Path $androidRes $d
    $spec = $densities[$d]

    # Foreground
    $fg = Generate-ForegroundIcon $spec.fg
    $fg.Save((Join-Path $dir "ic_launcher_foreground.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $fg.Dispose()

    # Square icon
    $sq = Generate-SquareIcon $spec.icon
    $sq.Save((Join-Path $dir "ic_launcher.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $sq.Dispose()

    # Round icon
    $rd = Generate-RoundIcon $spec.icon
    $rd.Save((Join-Path $dir "ic_launcher_round.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $rd.Dispose()

    Write-Host "Generated $d (icon: $($spec.icon)px, fg: $($spec.fg)px)"
}

# Splash screens
$splashes = @{
    "drawable"                 = @{ w = 480;  h = 320 }
    "drawable-port-mdpi"       = @{ w = 320;  h = 480 }
    "drawable-port-hdpi"       = @{ w = 480;  h = 800 }
    "drawable-port-xhdpi"      = @{ w = 720;  h = 1280 }
    "drawable-port-xxhdpi"     = @{ w = 960;  h = 1600 }
    "drawable-port-xxxhdpi"    = @{ w = 1280; h = 1920 }
    "drawable-land-mdpi"       = @{ w = 480;  h = 320 }
    "drawable-land-hdpi"       = @{ w = 800;  h = 480 }
    "drawable-land-xhdpi"      = @{ w = 1280; h = 720 }
    "drawable-land-xxhdpi"     = @{ w = 1600; h = 960 }
    "drawable-land-xxxhdpi"    = @{ w = 1920; h = 1280 }
}

foreach ($sp in $splashes.Keys) {
    $dir = Join-Path $androidRes $sp
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $dim = $splashes[$sp]
    $splash = Generate-Splash $dim.w $dim.h
    $splash.Save((Join-Path $dir "splash.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $splash.Dispose()
    Write-Host "Generated splash for $sp ($($dim.w)x$($dim.h))"
}

# Web PWA icons
$pwa192 = Generate-SquareIcon 192
$pwa192.Save((Join-Path $pwaDir "icon-192.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$pwa192.Dispose()

$pwa512 = Generate-SquareIcon 512
$pwa512.Save((Join-Path $pwaDir "icon-512.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$pwa512.Dispose()

$mask512 = Generate-SquareIcon 512
$mask512.Save((Join-Path $pwaDir "maskable-icon-512.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$mask512.Dispose()

$touch180 = Generate-SquareIcon 180
$touch180.Save((Join-Path $pwaDir "apple-touch-icon.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$touch180.Dispose()

$fgSrc.Dispose()
Write-Host "All CWP branding assets generated successfully!"
