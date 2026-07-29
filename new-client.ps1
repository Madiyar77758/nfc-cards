<#
    Создаёт страницу нового клиента из шаблона.

    Пример:
      .\new-client.ps1 -Slug dostar -Name "Чайхана Достар" -Initials "ЧД" `
          -Instagram "https://instagram.com/dostar" `
          -TikTok    "https://tiktok.com/@dostar" `
          -Gis       "https://go.2gis.com/xxxxx" `
          -Menu      "https://instagram.com/dostar"

    Ссылка для записи в NFC-карту получится такая:
      https://madiyar77758.github.io/nfc-cards/dostar/
#>

param(
    [Parameter(Mandatory = $true)][string]$Slug,
    [Parameter(Mandatory = $true)][string]$Name,
    [string]$Initials  = '',
    [string]$City      = 'Шымкент',
    [string]$Menu      = '',
    [string]$Instagram = '#',
    [string]$TikTok    = '#',
    [string]$Gis       = '#',
    [string]$Subtitle  = 'чайхана',
    [string]$BaseUrl   = 'https://madiyar77758.github.io/nfc-cards',
    [switch]$Force,
    # Только печатные материалы: страницу и меню не трогать.
    # Нужно для своих страниц, написанных вручную.
    [switch]$PrintOnly
)

$root         = Split-Path -Parent $MyInvocation.MyCommand.Path
$template     = Join-Path $root '_template\index.html'
$menuTemplate = Join-Path $root '_template\menu\index.html'
$outDir       = Join-Path $root $Slug
$outFile      = Join-Path $outDir 'index.html'
$menuDir      = Join-Path $outDir 'menu'
$menuFile     = Join-Path $menuDir 'index.html'
$cardTemplate = Join-Path $root '_template\card\index.html'
$cardDir      = Join-Path $outDir 'card'
$cardFile     = Join-Path $cardDir 'index.html'
$qrFile       = Join-Path $cardDir 'qr.svg'
$signTemplate  = Join-Path $root '_template\sign\index.html'
$signDir       = Join-Path $outDir 'sign'
$signFile      = Join-Path $signDir 'index.html'
$plateTemplate = Join-Path $root '_template\plate\index.html'
$plateDir      = Join-Path $outDir 'plate'
$plateFile     = Join-Path $plateDir 'index.html'
$qrScript     = Join-Path $root 'make-qr.js'
$clientUrl    = ($BaseUrl.TrimEnd('/')) + "/$Slug/"

if (-not (Test-Path $template)) {
    throw "Не найден шаблон: $template"
}
if ((Test-Path $outFile) -and (-not $Force) -and (-not $PrintOnly)) {
    throw "Страница $Slug уже есть. Добавь -Force, если правда хочешь перезаписать."
}

# Если инициалы не заданы — берём первые буквы первых двух слов названия.
if ([string]::IsNullOrWhiteSpace($Initials)) {
    $words = $Name -split '\s+' | Where-Object { $_ -ne '' }
    $Initials = -join ($words | Select-Object -First 2 | ForEach-Object { $_.Substring(0,1).ToUpper() })
}

# Ссылку на меню не задали — значит делаем клиенту свою страницу меню.
# Дальше её правят руками: блюда у всех разные, шаблон даёт только каркас.
$ownMenu = $false
if ([string]::IsNullOrWhiteSpace($Menu)) {
    if (Test-Path $menuTemplate) {
        $Menu    = 'menu/'
        $ownMenu = $true
    } else {
        $Menu = '#'
    }
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir | Out-Null
}

if (-not $PrintOnly) {
    $html = [System.IO.File]::ReadAllText($template, [System.Text.Encoding]::UTF8)

    $map = @{
        '{{NAME}}'          = $Name
        '{{INITIALS}}'      = $Initials
        '{{CITY}}'          = $City
        '{{URL_MENU}}'      = $Menu
        '{{URL_INSTAGRAM}}' = $Instagram
        '{{URL_TIKTOK}}'    = $TikTok
        '{{URL_2GIS}}'      = $Gis
    }
    foreach ($key in $map.Keys) {
        $html = $html.Replace($key, $map[$key])
    }

    # UTF-8 без BOM — иначе некоторые хостинги отдают кракозябры.
    [System.IO.File]::WriteAllText($outFile, $html, $utf8NoBom)
} else {
    $ownMenu = $false
}

if ($ownMenu) {
    # Название попадает и в JavaScript (заголовок вкладки при смене языка),
    # поэтому отдельно готовим экранированный вариант.
    $nameJson = '"' + $Name.Replace('\', '\\').Replace('"', '\"') + '"'

    $menuHtml = [System.IO.File]::ReadAllText($menuTemplate, [System.Text.Encoding]::UTF8)
    $menuHtml = $menuHtml.Replace('{{NAME_JSON}}', $nameJson).
                          Replace('{{NAME}}',      $Name).
                          Replace('{{INITIALS}}',  $Initials)
    if (-not (Test-Path $menuDir)) {
        New-Item -ItemType Directory -Path $menuDir | Out-Null
    }
    [System.IO.File]::WriteAllText($menuFile, $menuHtml, $utf8NoBom)
}

# Печатный макет карты плюс QR с той же ссылкой, что и в метке:
# у части телефонов NFC просто нет, для них работает только код.
$qrOk = $false
if (Test-Path $cardTemplate) {
    $cardHtml = [System.IO.File]::ReadAllText($cardTemplate, [System.Text.Encoding]::UTF8)
    $cardHtml = $cardHtml.Replace('{{NAME}}',     $Name).
                          Replace('{{INITIALS}}', $Initials).
                          Replace('{{CITY}}',     $City).
                          Replace('{{URL}}',      $clientUrl)

    if (-not (Test-Path $cardDir)) {
        New-Item -ItemType Directory -Path $cardDir | Out-Null
    }
    [System.IO.File]::WriteAllText($cardFile, $cardHtml, $utf8NoBom)

    if (Test-Path $qrScript) {
        & node $qrScript $clientUrl $qrFile
        $qrOk = ($LASTEXITCODE -eq 0)
    }
}

# Квадратная подставка на стол: тот же QR, крупнее.
if (Test-Path $signTemplate) {
    $signHtml = [System.IO.File]::ReadAllText($signTemplate, [System.Text.Encoding]::UTF8)
    $signHtml = $signHtml.Replace('{{NAME}}',     $Name).
                          Replace('{{INITIALS}}', $Initials).
                          Replace('{{CITY}}',     $City).
                          Replace('{{URL}}',      $clientUrl)

    if (-not (Test-Path $signDir)) {
        New-Item -ItemType Directory -Path $signDir | Out-Null
    }
    [System.IO.File]::WriteAllText($signFile, $signHtml, $utf8NoBom)
}

# Нарядная табличка с аркой, чайником и иконками разделов.
if (Test-Path $plateTemplate) {
    $plateHtml = [System.IO.File]::ReadAllText($plateTemplate, [System.Text.Encoding]::UTF8)
    $plateHtml = $plateHtml.Replace('{{NAME}}',     $Name).
                            Replace('{{SUBTITLE}}', $Subtitle).
                            Replace('{{INITIALS}}', $Initials).
                            Replace('{{CITY}}',     $City).
                            Replace('{{URL}}',      $clientUrl)

    if (-not (Test-Path $plateDir)) {
        New-Item -ItemType Directory -Path $plateDir | Out-Null
    }
    [System.IO.File]::WriteAllText($plateFile, $plateHtml, $utf8NoBom)
}

Write-Host ""
Write-Host "  $Name ($Initials), $City" -ForegroundColor Green
if ($PrintOnly) {
    Write-Host "  Страница:  не трогали (-PrintOnly)" -ForegroundColor DarkGray
} else {
    Write-Host "  Страница:  $outFile" -ForegroundColor Green
    if ($ownMenu) {
        Write-Host "  Меню:      $menuFile" -ForegroundColor Green
        Write-Host "             блюда в нём — образец, замени на настоящие" -ForegroundColor DarkYellow
    } else {
        Write-Host "  Меню:      внешняя ссылка $Menu"
    }
}
if (Test-Path $cardFile) {
    Write-Host "  Карта:     $cardFile" -ForegroundColor Green
}
if (Test-Path $signFile) {
    Write-Host "  Подставка: $signFile" -ForegroundColor Green
}
if (Test-Path $plateFile) {
    Write-Host "  Табличка:  $plateFile" -ForegroundColor Green
}
if ((Test-Path $cardTemplate) -and (-not $qrOk)) {
    Write-Host "  QR собрать не удалось — нужен Node.js и 'npm install'" -ForegroundColor Red
}
Write-Host ""
Write-Host "  В карту писать:  $clientUrl" -ForegroundColor Cyan
Write-Host "  Макет на печать: $($clientUrl)card/" -ForegroundColor Cyan
Write-Host ""
