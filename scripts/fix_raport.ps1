$f = "d:\koding\app.ppmawar\src\app\dashboard\penilaian\page.tsx"
$c = Get-Content $f -Raw
$c = $c -replace 'Sugio - Lamongan - Jawa Timur \| Website: ppmawar\.or\.id', 'Simo - Lamongan - Jawa Timur | Website: ppmawar.or.id'
$c = $c -replace 'KH\. Ahmad Taufiq, M\.Pd\.I', '{(raportData as any).kepala_madin || ''Agus Naqoub Ashrofun Nasr''}'
Set-Content $f $c -NoNewline
Write-Host "Done"
