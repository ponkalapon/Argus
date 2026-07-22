Add-Type -AssemblyName System.Drawing

$srcPath = "H:\argus\apps\argus-web\assets\icon.png"
$outDir = "H:\argus\apps\argus-web\store_assets"

if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir | Out-Null
}

$srcImg = [System.Drawing.Image]::FromFile($srcPath)

function MakeCover($width, $height, $outPath) {
    $bmp = New-Object System.Drawing.Bitmap($width, $height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.ColorTranslator]::FromHtml('#09090b'))
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    
    $targetSize = [int]($width * 0.55)
    $x = [int](($width - $targetSize) / 2)
    $y = [int](($height - $targetSize) / 2)
    
    $g.DrawImage($srcImg, $x, $y, $targetSize, $targetSize)
    $g.Dispose()
    
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

MakeCover 1080 1080 (Join-Path $outDir "logo_1080x1080.png")
MakeCover 720 1080 (Join-Path $outDir "poster_720x1080.png")

$srcImg.Dispose()
Write-Host "GENERATED_SUCCESSFULLY"
