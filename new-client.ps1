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
    [switch]$Force
)

$root         = Split-Path -Parent $MyInvocation.MyCommand.Path
$template     = Join-Path $root '_template\index.html'
$menuTemplate = Join-Path $root '_template\menu\index.html'
$outDir       = Join-Path $root $Slug
$outFile      = Join-Path $outDir 'index.html'
$menuDir      = Join-Path $outDir 'menu'
$menuFile     = Join-Path $menuDir 'index.html'

if (-not (Test-Path $template)) {
    throw "Не найден шаблон: $template"
}
if ((Test-Path $outFile) -and (-not $Force)) {
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

if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir | Out-Null
}

# UTF-8 без BOM — иначе некоторые хостинги отдают кракозябры.
[System.IO.File]::WriteAllText($outFile, $html, $utf8NoBom)

if ($ownMenu) {
    $menuHtml = [System.IO.File]::ReadAllText($menuTemplate, [System.Text.Encoding]::UTF8)
    $menuHtml = $menuHtml.Replace('{{NAME}}', $Name).Replace('{{INITIALS}}', $Initials)
    if (-not (Test-Path $menuDir)) {
        New-Item -ItemType Directory -Path $menuDir | Out-Null
    }
    [System.IO.File]::WriteAllText($menuFile, $menuHtml, $utf8NoBom)
}

Write-Host ""
Write-Host "  Готово: $outFile" -ForegroundColor Green
Write-Host "  Заведение: $Name ($Initials), $City"
if ($ownMenu) {
    Write-Host "  Меню:      $menuFile" -ForegroundColor Green
    Write-Host "             блюда в нём — образец, замени на настоящие" -ForegroundColor DarkYellow
} else {
    Write-Host "  Меню:      внешняя ссылка $Menu"
}
Write-Host ""
Write-Host "  В карту писать:  https://madiyar77758.github.io/nfc-cards/$Slug/" -ForegroundColor Cyan
Write-Host ""
