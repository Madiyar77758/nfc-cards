<#
    Готовит фотографии блюд для меню.

      .\add-photos.ps1 -Slug dostar -From "C:\Users\Madi\Downloads\dostar"

    Что делает: берёт все снимки из папки, обрезает по центру в квадрат,
    уменьшает до 800 px и сжимает. Снимок с телефона весит 3–5 МБ,
    после обработки — около 60–90 КБ. Без этого страница не откроется
    на кафешном Wi-Fi.

    Имена файлов должны совпадать с названиями блюд в меню:
      plov.jpg  beshbarmak.jpg  lagman.jpg  kuyrdak.jpg  manty.jpg
      shashlik.jpg  shashlik-ch.jpg  sorpa.jpg  shurpa.jpg  kespe.jpg
      achichuk.jpg  salat.jpg  solenya.jpg  morkov.jpg  samsa.jpg
      lepeshka.jpg  tokash.jpg  chakchak.jpg  med.jpg  kuraga.jpg

    Если имена другие — просто скинь папку как есть и скажи мне,
    я посмотрю снимки и переименую сам.
#>

param(
    [Parameter(Mandatory = $true)][string]$Slug,
    [Parameter(Mandatory = $true)][string]$From,
    [int]$Size = 800,
    [int]$Quality = 78
)

Add-Type -AssemblyName System.Drawing

$root   = Split-Path -Parent $MyInvocation.MyCommand.Path
$outDir = Join-Path $root "$Slug\menu\photo"

if (-not (Test-Path $From)) { throw "Папка не найдена: $From" }
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }

$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
         Where-Object { $_.MimeType -eq 'image/jpeg' }
$prm = New-Object System.Drawing.Imaging.EncoderParameters(1)
$prm.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
    [System.Drawing.Imaging.Encoder]::Quality, $Quality)

$files = Get-ChildItem $From -File | Where-Object { $_.Extension -match '^\.(jpg|jpeg|png|webp)$' }
if (-not $files) { throw "В папке нет изображений: $From" }

$totalBefore = 0
$totalAfter  = 0

foreach ($f in $files) {
    $dst = Join-Path $outDir ($f.BaseName.ToLower() + '.jpg')
    try {
        $img = [System.Drawing.Image]::FromFile($f.FullName)

        # центральный квадрат — на телефоне карточки квадратные
        $side = [Math]::Min($img.Width, $img.Height)
        $sx = [int](($img.Width  - $side) / 2)
        $sy = [int](($img.Height - $side) / 2)

        $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.InterpolationMode = 'HighQualityBicubic'
        $g.PixelOffsetMode   = 'HighQuality'
        $g.SmoothingMode     = 'HighQuality'
        $g.DrawImage($img,
            (New-Object System.Drawing.Rectangle(0, 0, $Size, $Size)),
            (New-Object System.Drawing.Rectangle($sx, $sy, $side, $side)),
            'Pixel')

        $bmp.Save($dst, $codec, $prm)
        $g.Dispose(); $bmp.Dispose(); $img.Dispose()

        $before = [math]::Round($f.Length / 1kb)
        $after  = [math]::Round((Get-Item $dst).Length / 1kb)
        $totalBefore += $before
        $totalAfter  += $after

        Write-Host ("  {0,-18} {1,6} КБ -> {2,4} КБ" -f $f.BaseName, $before, $after) -ForegroundColor Green
    } catch {
        Write-Host "  $($f.Name) — не обработалось: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host ("  Всего: {0} КБ -> {1} КБ" -f $totalBefore, $totalAfter) -ForegroundColor Cyan
Write-Host "  Папка: $outDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Дальше: пересобрать клиента через new-client.ps1 —" -ForegroundColor DarkGray
Write-Host "  где есть .jpg, карточка возьмёт фото вместо рисунка." -ForegroundColor DarkGray
