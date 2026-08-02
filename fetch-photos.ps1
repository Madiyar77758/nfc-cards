<#
    Тянет фотографии блюд с Викисклада, режет в квадрат и сжимает.

      .\fetch-photos.ps1 -Slug dostar

    Викисклад выбран потому, что там свободные лицензии и коммерческое
    использование разрешено. Автора каждого файла скрипт записывает
    в credits.txt — строчку с авторами надо оставить внизу меню.

    ВАЖНО: это годится только для демо. Настоящему клиенту ставим
    фотографии его собственной еды, иначе гость закажет по картинке
    и получит другое.
#>

param(
    [Parameter(Mandatory = $true)][string]$Slug,
    [int]$Size = 520,
    [switch]$Force,
    # Забрать только эти позиции: -Only plov,samsa
    [string[]]$Only,
    # Свой запрос вместо встроенного: -Query @{ samsa = 'somsa pastry' }
    [hashtable]$Query
)

Add-Type -AssemblyName System.Drawing

$root   = Split-Path -Parent $MyInvocation.MyCommand.Path
$outDir = Join-Path $root "$Slug\menu\photo"

# Викимедиа требует представляться и не частить: без этого прилетает 429.
$ua     = 'nfc-cards/1.0 (https://github.com/Madiyar77758/nfc-cards)'
$pause  = 2.0

function Get-WithRetry {
    param([string]$Url, [string]$OutFile, [string]$Agent, [int]$Tries = 3)
    for ($i = 1; $i -le $Tries; $i++) {
        try {
            if ($OutFile) { Invoke-WebRequest $Url -OutFile $OutFile -UserAgent $Agent -TimeoutSec 60; return $true }
            else          { return Invoke-RestMethod $Url -UserAgent $Agent -TimeoutSec 60 }
        } catch {
            $code = ''
            if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
            if ($code -eq 429 -and $i -lt $Tries) {
                Start-Sleep -Seconds (6 * $i)     # ждём дольше с каждой попыткой
                continue
            }
            if ($i -eq $Tries) { throw }
            Start-Sleep -Seconds 3
        }
    }
}

# блюдо -> что искать на Викискладе
$wanted = [ordered]@{
    'plov'        = 'plov pilaf rice'
    'beshbarmak'  = 'beshbarmak'
    'lagman'      = 'lagman noodles'
    'kuyrdak'     = 'kuurdak fried meat'
    'manty'       = 'manti dumplings steamed'
    'shashlik'    = 'shashlik lamb skewers'
    'shashlik-ch' = 'chicken shashlik skewers'
    'sorpa'       = 'lamb broth soup bowl'
    'shurpa'      = 'shurpa soup'
    'kespe'       = 'noodle soup homemade'
    'achichuk'    = 'achichuk salad tomato onion'
    'salat'       = 'beef salad pomegranate'
    'solenya'     = 'pickled vegetables assorted'
    'morkov'      = 'korean carrot salad'
    'samsa'       = 'samsa pastry baked'
    'lepeshka'    = 'tandoor bread non lepyoshka'
    'tokash'      = 'bread bun baked'
    'chakchak'    = 'chak-chak dessert'
    'med'         = 'honey walnuts bowl'
    'kuraga'      = 'dried apricots'
}

if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

$credits = @()

if ($Query) {
    foreach ($k in $Query.Keys) { $wanted[$k] = $Query[$k] }
}

foreach ($name in @($wanted.Keys)) {
    if ($Only -and ($Only -notcontains $name)) { continue }
    $dst = Join-Path $outDir "$name.jpg"
    if ((Test-Path $dst) -and (-not $Force)) {
        Write-Host "  $name — уже есть, пропускаю" -ForegroundColor DarkGray
        continue
    }

    # именно $search, а не $query: параметр -Query отличается только регистром,
    # а PowerShell регистр не различает — строка улетела бы в hashtable
    $search = $wanted[$name]
    $api = 'https://commons.wikimedia.org/w/api.php?action=query&format=json' +
           '&generator=search&gsrnamespace=6&gsrlimit=8' +
           '&gsrsearch=' + [uri]::EscapeDataString("filetype:bitmap $search") +
           '&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1200'

    Start-Sleep -Seconds $pause
    try {
        $r = Get-WithRetry -Url $api -Agent $ua
    } catch {
        Write-Host "  $name — поиск не удался: $($_.Exception.Message)" -ForegroundColor Red
        continue
    }

    $pages = @()
    if ($r.query -and $r.query.pages) {
        $pages = $r.query.pages.PSObject.Properties | ForEach-Object { $_.Value }
    }
    if (-not $pages) {
        Write-Host "  $name — ничего не найдено" -ForegroundColor Yellow
        continue
    }

    $done = $false
    foreach ($p in $pages) {
        $ii = $p.imageinfo[0]
        if (-not $ii) { continue }
        $url = $ii.thumburl
        if (-not $url) { $url = $ii.url }
        if ($url -notmatch '\.(jpg|jpeg|png)$' -and $url -notmatch '\.(jpg|jpeg|png)/') { continue }

        $tmp = [System.IO.Path]::GetTempFileName()
        try {
            Start-Sleep -Seconds $pause
            Get-WithRetry -Url $url -OutFile $tmp -Agent $ua | Out-Null
            $img = [System.Drawing.Image]::FromFile($tmp)

            # центральный квадрат, потом уменьшение
            $side = [Math]::Min($img.Width, $img.Height)
            $sx = [int](($img.Width  - $side) / 2)
            $sy = [int](($img.Height - $side) / 2)

            $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
            $g = [System.Drawing.Graphics]::FromImage($bmp)
            $g.InterpolationMode  = 'HighQualityBicubic'
            $g.PixelOffsetMode    = 'HighQuality'
            $g.SmoothingMode      = 'HighQuality'
            $g.DrawImage($img,
                (New-Object System.Drawing.Rectangle(0, 0, $Size, $Size)),
                (New-Object System.Drawing.Rectangle($sx, $sy, $side, $side)),
                'Pixel')

            $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
                     Where-Object { $_.MimeType -eq 'image/jpeg' }
            $prm = New-Object System.Drawing.Imaging.EncoderParameters(1)
            $prm.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
                [System.Drawing.Imaging.Encoder]::Quality, 74)
            $bmp.Save($dst, $codec, $prm)

            $g.Dispose(); $bmp.Dispose(); $img.Dispose()

            $author = $ii.extmetadata.Artist.value -replace '<[^>]+>', ''
            $lic    = $ii.extmetadata.LicenseShortName.value
            $credits += "$name — $($p.title) — $author — $lic"

            $kb = [math]::Round((Get-Item $dst).Length / 1kb)
            Write-Host "  $name — готово, $kb КБ" -ForegroundColor Green
            $done = $true
        } catch {
            $lastErr = $_.Exception.Message
        } finally {
            if (Test-Path $tmp) { Remove-Item $tmp -Force -ErrorAction SilentlyContinue }
        }
        if ($done) { break }
    }

    if (-not $done) {
        Write-Host "  $name — не скачалось: $lastErr" -ForegroundColor Yellow
    }
}

if ($credits.Count) {
    $credits | Set-Content (Join-Path $outDir 'credits.txt') -Encoding utf8
}
Write-Host ""
Write-Host "  Папка: $outDir" -ForegroundColor Cyan
Write-Host "  Авторы записаны в credits.txt" -ForegroundColor Cyan
