$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$d='D:\my-projects\高中課程\教材版型樣張'
[void][IO.Directory]::CreateDirectory($d)
$a=New-Object -ComObject PowerPoint.Application
$p=$a.Presentations.Add()
try {
$p.PageSetup.SlideWidth=540
$p.PageSetup.SlideHeight=720
$s=$p.Slides.Add(1,12)
function t($x,$y,$w,$h,$v,$n,$c=3154977,$bold=0){
$b=$s.Shapes.AddTextbox(1,$x,$y,$w,$h)
$f=$b.TextFrame
$f.MarginLeft=0;$f.MarginRight=0;$f.MarginTop=0;$f.MarginBottom=0
$r=$f.TextRange;$r.Text=$v;$r.Font.Name='Microsoft JhengHei';$r.Font.NameFarEast='Microsoft JhengHei';$r.Font.Size=$n;$r.Font.Color.RGB=$c;$r.Font.Bold=[int]$bold
}
function rule($y){$l=$s.Shapes.AddLine(38,$y,502,$y);$l.Line.ForeColor.RGB=12633527}
$s.FollowMasterBackground=0;$s.Background.Fill.ForeColor.RGB=16251900
t 38 36 464 25 '物理　／　熱學' 13
t 38 78 470 50 '同樣是 17°C，升溫一樣嗎？' 26 3154977 -1
t 38 136 470 26 '來源標示示例：原講義 §1-1 第 8 頁、§4-3 第 32 頁' 12
rule 176
t 38 202 460 32 '例題 01　讀懂溫度的變化量' 19 3154977 -1
t 38 247 460 65 '兩天的午後氣溫相同。觀察下表，哪一天從早晨到午後升溫較多？' 17
$t=$s.Shapes.AddTable(3,3,38,329,464,109).Table
$vals=@('時段','星期一','星期二','早晨','12°C','15°C','午後','17°C','17°C')
for($i=1;$i -le 3;$i++){for($j=1;$j -le 3;$j++){$z=$t.Cell($i,$j).Shape;$z.Fill.ForeColor.RGB=16251900;if($i -eq 1){$z.Fill.ForeColor.RGB=14610137};$r=$z.TextFrame.TextRange;$r.Text=$vals[($i-1)*3+$j-1];$r.Font.Color.RGB=3154977;$r.Font.NameFarEast='Microsoft JhengHei';$r.Font.Size=16}}
t 38 452 460 25 '表 1　兩天的早晨與午後氣溫' 12
t 38 508 464 36 '第一步　分別找出起點與終點' 20 6319632 -1
t 38 554 464 94 '題目問的是升溫多少，所以要用午後溫度減去早晨溫度。用 ΔT 記錄這個差值：星期一升了 5°C，星期二升了 2°C。' 17
rule 670
t 38 683 420 22 '熱學　／　溫度變化' 11
t 487 683 20 22 '1' 11
$p.SaveAs("$d\溫度變化.pptx",24)

$p.SaveAs("$d\溫度變化.pdf",32)
$s.Export("$d\直式整頁.png",'PNG',1080,1440)
$w=$p.Windows.Item(1);$w.View.ZoomToFit=-1
Add-Type 'using System;using System.Runtime.InteropServices;public class PCap{[DllImport("user32.dll")]public static extern bool PrintWindow(IntPtr w,IntPtr d,uint f);[DllImport("user32.dll")]public static extern bool GetWindowRect(IntPtr w,out R r);public struct R{public int l,t,r,b;}}'
Start-Sleep -Milliseconds 800
$hw=[IntPtr]$w.HWND;$rc=New-Object PCap+R
[void][PCap]::GetWindowRect($hw,[ref]$rc)
$bm=New-Object Drawing.Bitmap(($rc.r-$rc.l),($rc.b-$rc.t))
$g=[Drawing.Graphics]::FromImage($bm);$dc=$g.GetHdc()
try{if(![PCap]::PrintWindow($hw,$dc,2)){throw '視窗截取失敗'}}finally{$g.ReleaseHdc($dc);$g.Dispose()}
$bm.Save("$d\PowerPoint視窗.png",[Drawing.Imaging.ImageFormat]::Png);$bm.Dispose()
}finally{$p.Close()}
