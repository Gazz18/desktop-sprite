# 生成托盘图标 assets/icon.png（狸宝白猫头像，透明底）
# 用法: powershell -NoProfile -File scripts/make-icon.ps1
# 说明: 先按 4x 超采样绘制，再高质量下采样到 32x32，避免小尺寸下锯齿糊成一团。
Add-Type -AssemblyName System.Drawing

$target = (Resolve-Path (Join-Path $PSScriptRoot '..\assets')).Path
$target = Join-Path $target 'icon.png'
$size   = 32
$scale  = 4
$big    = $size * $scale

function New-PointF($x, $y) { [System.Drawing.PointF]::new($x * $scale, $y * $scale) }

function Fill-Tri($g, $brush, $p1, $p2, $p3) {
  $pts = @(New-PointF @p1; New-PointF @p2; New-PointF @p3)
  $g.FillPolygon($brush, [System.Drawing.PointF[]]$pts)
}

$bmp = [System.Drawing.Bitmap]::new($big, $big, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.Clear([System.Drawing.Color]::Transparent)

$white   = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
$pink    = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 255, 145, 180))
$deep    = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 74, 62, 72))
# 描边必须用主题粉色：白猫 + 白/浅灰描边在浅色任务栏上会直接“看不见”
$outline = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 255, 111, 158), ($scale * 1.5))

# 耳朵（先画，根部被头部压住）——粉色实勾边，保证小尺寸下能认出猫耳
Fill-Tri $g $pink @(6, 10) @(10, 1) @(15, 9)
Fill-Tri $g $pink @(26, 10) @(22, 1) @(17, 9)
Fill-Tri $g $white @(7.6, 9.2) @(10.3, 3.6) @(13.4, 8.6)
Fill-Tri $g $white @(24.4, 9.2) @(21.7, 3.6) @(18.6, 8.6)

# 头
$g.FillEllipse($white, (3 * $scale), (7 * $scale), (26 * $scale), (23 * $scale))
$g.DrawEllipse($outline, (3 * $scale), (7 * $scale), (26 * $scale), (23 * $scale))

# 眼睛
$g.FillEllipse($deep, (10 * $scale), (15 * $scale), (3.4 * $scale), (4.6 * $scale))
$g.FillEllipse($deep, (18.6 * $scale), (15 * $scale), (3.4 * $scale), (4.6 * $scale))

# 鼻子
Fill-Tri $g $pink @(14.6, 21) @(17.4, 21) @(16, 23.2)

$g.Dispose()

# 下采样到 32x32（目标矩形必须是 $size，写错成 $big 会只截到源图左上角的空白区）
$out = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g2 = [System.Drawing.Graphics]::FromImage($out)
$g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g2.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g2.DrawImage($bmp, 0, 0, $size, $size)
$g2.Dispose()
$bmp.Dispose()

$out.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)
$out.Dispose()

Write-Host "已生成: $target"
