  # =====================================================================
  # HRCloud Base - Bulk photos from local Windows folder to Supabase
  # =====================================================================

  # ---------------------------
  # Config
  # ---------------------------
  $SupabaseUrl = 'https://qymoohwtxceggtvgjfsv.supabase.co'
  $SupabaseServiceRoleKey = $env:SUPABASE_SERVICE_ROLE_KEY
  $TenantId = '8cb84ecf-4d74-4aac-84cc-0c66da4aa656'
  $PhotoDir = 'C:\Users\aps-ecuador\Downloads\fotos'
  $Mode = 'Simulate'   # Simulate | Real
  $Bucket = 'employee_photos'
  $ReportCsv = Join-Path $PhotoDir 'photo-upload-report.csv'
  $MaxReusePerFile = 4
  $AllowReuseForGenericFiles = $false
  $MinScore = 70

  if (-not (Test-Path -LiteralPath $PhotoDir)) {
    throw "No existe la carpeta: $PhotoDir"
  }
  if ($Mode -ne 'Simulate' -and $Mode -ne 'Real') {
    throw "Modo inválido: $Mode. Usa Simulate o Real."
  }
  if ([string]::IsNullOrWhiteSpace($SupabaseServiceRoleKey) -or $SupabaseServiceRoleKey -like 'PEGA_AQUI_*') {
    throw 'Falta SUPABASE_SERVICE_ROLE_KEY o sigue con placeholder. Definela en la sesión de PowerShell antes de ejecutar.'
  }

  $AllowedExtensions = @('.jpg', '.jpeg', '.png', '.webp')

  # ---------------------------
  # Helpers
  # ---------------------------
  function Normalize-Text {
    param([string]$Value)

    if ([string]::IsNullOrWhiteSpace($Value)) {
      return ''
    }

    $normalized = $Value.Normalize([System.Text.NormalizationForm]::FormD)
    $sb = New-Object System.Text.StringBuilder

    foreach ($ch in $normalized.ToCharArray()) {
      $cat = [System.Globalization.CharUnicodeInfo]::GetUnicodeCategory($ch)
      if ($cat -ne [System.Globalization.UnicodeCategory]::NonSpacingMark) {
        [void]$sb.Append($ch)
      }
    }

    $text = $sb.ToString().ToLowerInvariant()
    $text = $text -replace '[^a-z0-9]+', ' '
    $text = $text -replace '\s+', ' '
    return $text.Trim()
  }

  function Get-Tokens {
    param([string]$Value)

    $text = Normalize-Text $Value
    if ([string]::IsNullOrWhiteSpace($text)) {
      return @()
    }
    return $text.Split(' ') | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
  }

  function DigitsOnly {
    param([string]$Value)

    if ([string]::IsNullOrWhiteSpace($Value)) {
      return ''
    }

    return ($Value -replace '\D+', '')
  }

  function Safe-Segment {
    param([string]$Value)

    $text = Normalize-Text $Value
    $text = $text -replace '\s+', '_'
    $text = $text -replace '[^a-z0-9_]+', ''
    $text = $text.Trim('_')

    if ([string]::IsNullOrWhiteSpace($text)) {
      return 'photo'
    }

    return $text
  }

  function Get-DisplayName {
    param($Employee)

    if ($Employee.full_name -and -not [string]::IsNullOrWhiteSpace([string]$Employee.full_name)) {
      return [string]$Employee.full_name
    }

    $parts = @()
    if ($Employee.first_name -and -not [string]::IsNullOrWhiteSpace([string]$Employee.first_name)) {
      $parts += [string]$Employee.first_name
    }
    if ($Employee.last_name -and -not [string]::IsNullOrWhiteSpace([string]$Employee.last_name)) {
      $parts += [string]$Employee.last_name
    }

    $name = ($parts -join ' ').Trim()
    if ([string]::IsNullOrWhiteSpace($name)) {
      if ($Employee.employee_code -and -not [string]::IsNullOrWhiteSpace([string]$Employee.employee_code)) {
        return [string]$Employee.employee_code
      }
      return [string]$Employee.id
    }

    return $name
  }

  function Get-Headers {
    @{
      apikey        = $SupabaseServiceRoleKey
      Authorization = "Bearer $SupabaseServiceRoleKey"
    }
  }

  function Invoke-DbGet {
    param([string]$Url)

    Invoke-RestMethod -Method Get -Uri $Url -Headers (Get-Headers) -ErrorAction Stop
  }

  function Invoke-DbPatch {
    param(
      [string]$Url,
      [hashtable]$Body
    )

    Invoke-RestMethod -Method Patch -Uri $Url -Headers (Get-Headers) -ContentType 'application/json' -Body ($Body | ConvertTo-Json -Compress -Depth 10) -ErrorAction Stop
  }

  function Upload-Photo {
    param(
      [string]$ObjectPath,
      [string]$FilePath
    )

    $uploadUrl = "$SupabaseUrl/storage/v1/object/$Bucket/$ObjectPath"
    $contentType = switch ([System.IO.Path]::GetExtension($FilePath).ToLowerInvariant()) {
      '.jpg'  { 'image/jpeg' }
      '.jpeg' { 'image/jpeg' }
      '.png'  { 'image/png' }
      '.webp' { 'image/webp' }
      default { 'application/octet-stream' }
    }

    Invoke-RestMethod -Method Post -Uri $uploadUrl -Headers (Get-Headers) -InFile $FilePath -ContentType $contentType -ErrorAction Stop | Out-Null
  }

  function Get-EmployeeGender {
    param($Employee)

    $genderRaw = ''
    if ($Employee.gender -and -not [string]::IsNullOrWhiteSpace([string]$Employee.gender)) {
      $genderRaw = Normalize-Text ([string]$Employee.gender)
    }

    if ($genderRaw -match 'femen|female|mujer|f$') { return 'female' }
    if ($genderRaw -match 'mascul|male|hombre|varon|varón|m$') { return 'male' }

    $firstName = ''
    if ($Employee.first_name -and -not [string]::IsNullOrWhiteSpace([string]$Employee.first_name)) {
      $firstName = Normalize-Text ([string]$Employee.first_name)
    }

    if ($firstName -match '^(maria|ana|laura|paola|karla|karen|gabriela|patricia|carmen|jennifer|veronica|verónica|susana|elena|alejandra|silvia|
  adriana|marcela|monica|mónica|daniela|camila|luisa|gloria|rocio|rocio)$') {
      return 'female'
    }

    if ($firstName -match '^(juan|jose|jos[eé]|pedro|carlos|andres|andrés|jorge|miguel|luis|fernando|diego|oscar|oscar|ricardo|edwin|franklin|
  francisco|alexander|wilson|edgar|henry)$') {
      return 'male'
    }

    if ($firstName.EndsWith('a')) { return 'female' }
    if ($firstName.EndsWith('o') -or $firstName.EndsWith('r') -or $firstName.EndsWith('n') -or $firstName.EndsWith('l')) { return 'male' }

    return 'unknown'
  }

  function Get-PrimaryBucket {
    param([string]$Text)

    $t = Normalize-Text $Text

    $rules = @(
      @{ bucket = 'executive';     patterns = @('gerente general', 'director general', 'director ejecutivo', 'ceo', 'gerente', 'subgerente') }
      @{ bucket = 'jefatura';      patterns = @('jefe de area', 'jefe de área', 'jefe', 'coordinador', 'supervisor', 'responsable', 'encargado',
  'lead') }
      @{ bucket = 'rrhh';          patterns = @('rrhh', 'recursos humanos', 'talento humano', 'talento') }
      @{ bucket = 'contabilidad';  patterns = @('contabilidad', 'contador', 'contable', 'asistente contable', 'tesoreria', 'tesorería',
  'finanzas') }
      @{ bucket = 'helpdesk';      patterns = @('helpdesk', 'soporte', 'tecnico soporte', 'técnico soporte', 'it', 'sistemas') }
      @{ bucket = 'logistica';     patterns = @('logistica', 'logística', 'bodega', 'almacen', 'almacén', 'despacho', 'inventario', 'distribucion',
  'distribución') }
      @{ bucket = 'taller';        patterns = @('taller', 'mecanico', 'mecánico', 'operario taller', 'supervisor taller') }
      @{ bucket = 'ventas';        patterns = @('ventas', 'vendedor', 'vendedora', 'comercial', 'asesor comercial') }
      @{ bucket = 'operativo';     patterns = @('operario', 'trabajador', 'operaria', 'auxiliar', 'produccion', 'producción', 'planta',
  'cargador') }
      @{ bucket = 'administrativo'; patterns = @('asistente', 'auxiliar administrativo', 'administrativo', 'secretaria', 'analista') }
    )

    foreach ($rule in $rules) {
      foreach ($pattern in $rule.patterns) {
        $p = Normalize-Text $pattern
        if ($t.Contains($p)) {
          return [string]$rule.bucket
        }
      }
    }

    return 'general'
  }

  function Get-FileGenderHint {
    param([string]$Text)

    $t = Normalize-Text $Text

    if ($t -match '(^| )mujer( |$)|(^| )femenin[oa]( |$)|(^| )female( |$)') { return 'female' }
    if ($t -match '(^| )hombre( |$)|(^| )masculin[oa]( |$)|(^| )male( |$)|(^| )varon( |$)|(^| )varón( |$)') { return 'male' }

    return 'unknown'
  }

  function Get-FileProfile {
    param([System.IO.FileInfo]$File)

    $base = [System.IO.Path]::GetFileNameWithoutExtension($File.Name)
    $norm = Normalize-Text $base
    $genderHint = Get-FileGenderHint $base
    $bucket = Get-PrimaryBucket $base

    $hasCodeLikeName = ($norm -match '^[a-z0-9]{4,}$')
    $isSpecific = $hasCodeLikeName

    [pscustomobject]@{
      FileName    = $File.Name
      BaseName    = $base
      Normalized  = $norm
      Bucket      = $bucket
      GenderHint  = $genderHint
      IsSpecific  = $isSpecific
      IsReusable  = (-not $isSpecific)
    }
  }

  function Get-EmployeeProfile {
    param($Employee)

    $displayName = Get-DisplayName $Employee
    $normName = Normalize-Text $displayName
    $bucket = Get-PrimaryBucket ([string]$Employee.position)
    $gender = Get-EmployeeGender $Employee
    $codeNorm = Normalize-Text ([string]$Employee.employee_code)
    $cedulaDigits = DigitsOnly ([string]$Employee.cedula)

    [pscustomobject]@{
      Raw           = $Employee
      DisplayName   = $displayName
      Normalized    = $normName
      Bucket        = $bucket
      Gender        = $gender
      CodeNorm      = $codeNorm
      CedulaDigits  = $cedulaDigits
    }
  }

  function Score-Employee {
    param(
      $EmployeeProfile,
      $FileProfile
    )

    $employee = $EmployeeProfile.Raw
    $score = 0
    $reasons = New-Object System.Collections.Generic.List[string]

    $fileNorm = $FileProfile.Normalized
    $empNameNorm = $EmployeeProfile.Normalized
    $empCodeNorm = $EmployeeProfile.CodeNorm

    # Exact employee_code
    if (-not [string]::IsNullOrWhiteSpace($empCodeNorm)) {
      if ($fileNorm -eq $empCodeNorm -or $fileNorm.Contains($empCodeNorm)) {
        $score += 1000
        [void]$reasons.Add('exact_employee_code')
        return [pscustomobject]@{
          Score   = $score
          Reasons = $reasons.ToArray()
          Match   = 'exact_employee_code'
        }
      }
    }

    # Exact or near full name
    if (-not [string]::IsNullOrWhiteSpace($empNameNorm)) {
      if ($fileNorm -eq $empNameNorm) {
        $score += 600
        [void]$reasons.Add('exact_full_name')
      }
      elseif ($fileNorm.Contains($empNameNorm)) {
        $score += 400
        [void]$reasons.Add('contains_full_name')
      }
      else {
        $nameTokens = Get-Tokens $empNameNorm
        $hits = 0
        foreach ($tok in $nameTokens) {
          if ($tok.Length -ge 3 -and $fileNorm.Contains($tok)) {
            $hits++
          }
        }
        if ($hits -ge 2) {
          $score += 250
          [void]$reasons.Add('name_tokens_match')
        }
        elseif ($hits -eq 1) {
          $score += 80
          [void]$reasons.Add('name_token_partial')
        }
      }
    }

    # Bucket / role match
    if ($FileProfile.Bucket -ne 'general' -and $FileProfile.Bucket -eq $EmployeeProfile.Bucket) {
      $score += 140
      [void]$reasons.Add("bucket_match:$($FileProfile.Bucket)")
    }
    elseif ($FileProfile.Bucket -ne 'general') {
      # Soft role compatibility by bucket family
      if (($FileProfile.Bucket -eq 'jefatura' -and $EmployeeProfile.Bucket -eq 'executive') -or
          ($FileProfile.Bucket -eq 'executive' -and $EmployeeProfile.Bucket -eq 'jefatura')) {
        $score += 70
        [void]$reasons.Add('adjacent_hierarchy_match')
      }
    }

    # Gender hint
    $fileGender = $FileProfile.GenderHint
    $empGender = $EmployeeProfile.Gender
    if ($fileGender -ne 'unknown' -and $empGender -ne 'unknown') {
      if ($fileGender -eq $empGender) {
        $score += 35
        [void]$reasons.Add("gender_match:$fileGender")
      }
      else {
        $score -= 20
        [void]$reasons.Add("gender_conflict:file=$fileGender employee=$empGender")
      }
    }

    # Extra hints from file text
    if ($FileProfile.Normalized.Contains('mujer') -and $empGender -eq 'female') {
      $score += 25
      [void]$reasons.Add('female_hint_match')
    }
    if (($FileProfile.Normalized.Contains('jefe') -or $FileProfile.Normalized.Contains('gerente')) -and $EmployeeProfile.Bucket -eq 'executive') {
      $score += 20
      [void]$reasons.Add('leadership_hint_match')
    }
    if (($FileProfile.Normalized.Contains('rrhh')) -and $EmployeeProfile.Bucket -eq 'rrhh') {
      $score += 20
      [void]$reasons.Add('rrhh_hint_match')
    }
    if (($FileProfile.Normalized.Contains('contabilidad') -or $FileProfile.Normalized.Contains('contable')) -and $EmployeeProfile.Bucket -eq
  'contabilidad') {
      $score += 20
      [void]$reasons.Add('accounting_hint_match')
    }

    [pscustomobject]@{
      Score   = $score
      Reasons = $reasons.ToArray()
      Match   = 'inferred'
    }
  }

  function Write-ReportRow {
    param(
      [System.Collections.Generic.List[object]]$Report,
      [string]$ArchivoLocal,
      [string]$DescripcionArchivo,
      [string]$EmployeeId,
      [string]$EmployeeCode,
      [string]$FullName,
      [string]$Position,
      [string]$TipoMatch,
      [string]$Resultado,
      [string]$Observacion,
      [string]$ObjectPath,
      [string]$Score
    )

    [void]$Report.Add([pscustomobject]@{
      archivo_local      = $ArchivoLocal
      descripcion_archivo = $DescripcionArchivo
      employee_id        = $EmployeeId
      employee_code      = $EmployeeCode
      full_name          = $FullName
      position           = $Position
      tipo_match         = $TipoMatch
      resultado          = $Resultado
      observacion        = $Observacion
      object_path        = $ObjectPath
      score              = $Score
      modo               = $Mode
    })
  }

  # ---------------------------
  # Load employees
  # ---------------------------
  Write-Host "Cargando empleados del tenant $TenantId..." -ForegroundColor Cyan

  $select = [uri]::EscapeDataString('id,tenant_id,employee_code,full_name,first_name,last_name,position,cedula,gender,facial_photo_url')
  $order = [uri]::EscapeDataString('last_name.asc,first_name.asc')
  $employeesUrl = "$SupabaseUrl/rest/v1/employees?select=$select&tenant_id=eq.$TenantId&order=$order"

  $employeesRaw = Invoke-DbGet -Url $employeesUrl
  if ($null -eq $employeesRaw) {
    $employeesRaw = @()
  }

  $employeeProfiles = New-Object System.Collections.Generic.List[object]
  foreach ($emp in $employeesRaw) {
    if ($emp.facial_photo_url -and -not [string]::IsNullOrWhiteSpace([string]$emp.facial_photo_url)) {
      continue
    }
    [void]$employeeProfiles.Add((Get-EmployeeProfile -Employee $emp))
  }

  Write-Host ("Empleados candidatos sin foto: {0}" -f $employeeProfiles.Count) -ForegroundColor Cyan

  # ---------------------------
  # Load files
  # ---------------------------
  $files = Get-ChildItem -LiteralPath $PhotoDir -File | Where-Object {
    $AllowedExtensions -contains $_.Extension.ToLowerInvariant()
  }

  if ($files.Count -eq 0) {
    throw 'No se encontraron imágenes válidas (.jpg, .jpeg, .png, .webp) en la carpeta.'
  }

  Write-Host ("Archivos válidos encontrados: {0}" -f $files.Count) -ForegroundColor Cyan
  Write-Host ("Bucket real: {0}" -f $Bucket) -ForegroundColor Cyan
  Write-Host ("Modo: {0}" -f $Mode) -ForegroundColor Cyan

  # ---------------------------
  # Process files
  # ---------------------------
  $report = New-Object System.Collections.Generic.List[object]
  $usedEmployeeIds = @{}

  foreach ($file in $files) {
    $profile = Get-FileProfile -File $file
    $baseName = $profile.BaseName
    $safeFileName = (Safe-Segment $baseName) + $file.Extension.ToLowerInvariant()

    # 1) Exact code / exact name candidates
    $exactCandidates = New-Object System.Collections.Generic.List[object]
    foreach ($emp in $employeeProfiles) {
      $e = $emp.Raw
      $codeNorm = $emp.CodeNorm
      $nameNorm = $emp.Normalized

      if (-not [string]::IsNullOrWhiteSpace($codeNorm)) {
        if ($profile.Normalized -eq $codeNorm -or $profile.Normalized.Contains($codeNorm)) {
          [void]$exactCandidates.Add([pscustomobject]@{
            Employee = $emp
            Match = 'exact_employee_code'
            Score = 1000
            Reasons = @('exact_employee_code')
          })
          continue
        }
      }

      if (-not [string]::IsNullOrWhiteSpace($nameNorm)) {
        if ($profile.Normalized -eq $nameNorm -or $profile.Normalized.Contains($nameNorm)) {
          [void]$exactCandidates.Add([pscustomobject]@{
            Employee = $emp
            Match = 'exact_full_name'
            Score = 600
            Reasons = @('exact_full_name')
          })
        }
      }
    }

    $selectedCandidates = New-Object System.Collections.Generic.List[object]

    if ($exactCandidates.Count -gt 0) {
      if ($exactCandidates.Count -gt 1) {
        Write-ReportRow -Report $report `
          -ArchivoLocal $file.Name `
          -DescripcionArchivo $baseName `
          -EmployeeId '' `
          -EmployeeCode '' `
          -FullName '' `
          -Position '' `
          -TipoMatch 'ambiguous_exact' `
          -Resultado 'skipped' `
          -Observacion 'Más de un empleado coincide exactamente con employee_code o full_name.' `
          -ObjectPath '' `
          -Score ''
        Write-Host "[AMBIGUOUS EXACT] $($file.Name)" -ForegroundColor Red
        continue
      }

      [void]$selectedCandidates.Add($exactCandidates[0])
    }
    else {
      # 2) Infer by role + gender
      $scored = New-Object System.Collections.Generic.List[object]
      foreach ($emp in $employeeProfiles) {
        $scoreInfo = Score-Employee -EmployeeProfile $emp -FileProfile $profile
        if ($scoreInfo.Score -ge $MinScore) {
          [void]$scored.Add([pscustomobject]@{
            Employee = $emp
            Match = $scoreInfo.Match
            Score = $scoreInfo.Score
            Reasons = $scoreInfo.Reasons
          })
        }
      }

      if ($scored.Count -eq 0) {
        Write-ReportRow -Report $report `
          -ArchivoLocal $file.Name `
          -DescripcionArchivo $baseName `
          -EmployeeId '' `
          -EmployeeCode '' `
          -FullName '' `
          -Position '' `
          -TipoMatch 'no_match' `
          -Resultado 'skipped' `
          -Observacion 'No hubo candidato con score suficiente.' `
          -ObjectPath '' `
          -Score ''
        Write-Host "[NO MATCH] $($file.Name)" -ForegroundColor DarkYellow
        continue
      }

      $sorted = $scored | Sort-Object Score -Descending
      $topScore = [int]$sorted[0].Score
      $topGroup = @($sorted | Where-Object { [int]$_.Score -eq $topScore })

      if ($topGroup.Count -gt $MaxReusePerFile) {
        Write-ReportRow -Report $report `
          -ArchivoLocal $file.Name `
          -DescripcionArchivo $baseName `
          -EmployeeId '' `
          -EmployeeCode '' `
          -FullName '' `
          -Position '' `
          -TipoMatch 'ambiguous' `
          -Resultado 'skipped' `
          -Observacion ("Demasiados candidatos con el mismo score top ({0})." -f $topScore) `
          -ObjectPath '' `
          -Score ($topScore.ToString())
        Write-Host "[AMBIGUOUS] $($file.Name) -> topScore $topScore with $($topGroup.Count) candidates" -ForegroundColor Red
        continue
      }

      # Conservative mode: pick a single primary candidate.
      # Generic files can be reviewed manually from the CSV if there is a tie.
      if ($topGroup.Count -eq 1) {
        [void]$selectedCandidates.Add($topGroup[0])
      }
      elseif ($AllowReuseForGenericFiles -and $topGroup.Count -gt 1) {
        foreach ($cand in $topGroup) {
          [void]$selectedCandidates.Add($cand)
        }
      }
      else {
        Write-ReportRow -Report $report `
          -ArchivoLocal $file.Name `
          -DescripcionArchivo $baseName `
          -EmployeeId '' `
          -EmployeeCode '' `
          -FullName '' `
          -Position '' `
          -TipoMatch 'ambiguous_tie' `
          -Resultado 'skipped' `
          -Observacion ("Empate en score top ({0}) con {1} candidatos. Se deja para revisión manual." -f $topScore, $topGroup.Count) `
          -ObjectPath '' `
          -Score ($topScore.ToString())
        Write-Host "[AMBIGUOUS TIE] $($file.Name) -> topScore $topScore with $($topGroup.Count) candidates" -ForegroundColor Red
        continue
      }
    }

    # 3) Execute selected candidates
    foreach ($cand in $selectedCandidates) {
      $emp = $cand.Employee
      $employee = $emp.Raw
      $employeeId = [string]$employee.id
      $employeeCode = [string]$employee.employee_code
      $fullName = $emp.DisplayName
      $position = [string]$employee.position
      $objectPath = "$TenantId/$employeeId/$safeFileName"

      # Avoid same employee multiple times in the same batch
      if ($usedEmployeeIds.ContainsKey($employeeId)) {
        Write-ReportRow -Report $report `
          -ArchivoLocal $file.Name `
          -DescripcionArchivo $baseName `
          -EmployeeId $employeeId `
          -EmployeeCode $employeeCode `
          -FullName $fullName `
          -Position $position `
          -TipoMatch 'duplicate_in_batch' `
          -Resultado 'skipped' `
          -Observacion 'Este empleado ya fue asociado a otra foto en este mismo lote.' `
          -ObjectPath '' `
          -Score ([string]$cand.Score)
        continue
      }

      # Do not overwrite existing photo
      if ($employee.facial_photo_url -and -not [string]::IsNullOrWhiteSpace([string]$employee.facial_photo_url)) {
        Write-ReportRow -Report $report `
          -ArchivoLocal $file.Name `
          -DescripcionArchivo $baseName `
          -EmployeeId $employeeId `
          -EmployeeCode $employeeCode `
          -FullName $fullName `
          -Position $position `
          -TipoMatch $cand.Match `
          -Resultado 'skipped' `
          -Observacion ("Ya existe facial_photo_url: {0}" -f [string]$employee.facial_photo_url) `
          -ObjectPath ([string]$employee.facial_photo_url) `
          -Score ([string]$cand.Score)
        continue
      }

      if ($Mode -eq 'Simulate') {
        Write-Host "[DRY-RUN] $($file.Name) -> $employeeCode | $objectPath | score=$($cand.Score)" -ForegroundColor Cyan
        Write-ReportRow -Report $report `
          -ArchivoLocal $file.Name `
          -DescripcionArchivo $baseName `
          -EmployeeId $employeeId `
          -EmployeeCode $employeeCode `
          -FullName $fullName `
          -Position $position `
          -TipoMatch $cand.Match `
          -Resultado 'pending' `
          -Observacion ("Se subiría y enlazaría a {0}. Reasons: {1}" -f $objectPath, (($cand.Reasons -join ', '))) `
          -ObjectPath $objectPath `
          -Score ([string]$cand.Score)

        $usedEmployeeIds[$employeeId] = $true
        continue
      }

      # Real mode
      try {
        Write-Host "[UPLOAD] $($file.Name) -> $employeeCode | $objectPath | score=$($cand.Score)" -ForegroundColor Green
        Upload-Photo -ObjectPath $objectPath -FilePath $file.FullName

        $patchUrl = "$SupabaseUrl/rest/v1/employees?id=eq.$employeeId&tenant_id=eq.$TenantId"
        Invoke-DbPatch -Url $patchUrl -Body @{ facial_photo_url = $objectPath } | Out-Null

        Write-ReportRow -Report $report `
          -ArchivoLocal $file.Name `
          -DescripcionArchivo $baseName `
          -EmployeeId $employeeId `
          -EmployeeCode $employeeCode `
          -FullName $fullName `
          -Position $position `
          -TipoMatch $cand.Match `
          -Resultado 'ok' `
          -Observacion ("Foto subida y facial_photo_url actualizado. Reasons: {0}" -f (($cand.Reasons -join ', '))) `
          -ObjectPath $objectPath `
          -Score ([string]$cand.Score)

        $usedEmployeeIds[$employeeId] = $true
        Write-Host "[OK] $($file.Name) -> $employeeCode" -ForegroundColor Green
      }
      catch {
        Write-ReportRow -Report $report `
          -ArchivoLocal $file.Name `
          -DescripcionArchivo $baseName `
          -EmployeeId $employeeId `
          -EmployeeCode $employeeCode `
          -FullName $fullName `
          -Position $position `
          -TipoMatch $cand.Match `
          -Resultado 'error' `
          -Observacion $_.Exception.Message `
          -ObjectPath $objectPath `
          -Score ([string]$cand.Score)

        Write-Host "[ERROR] $($file.Name) -> $($_.Exception.Message)" -ForegroundColor Red
      }
    }
  }

  # ---------------------------
  # Export report
  # ---------------------------
  $report | Export-Csv -LiteralPath $ReportCsv -NoTypeInformation -Encoding UTF8

  Write-Host ''
  Write-Host '================= RESUMEN =================' -ForegroundColor Cyan
  Write-Host ("Total archivos procesados: {0}" -f $files.Count)
  Write-Host ("Reporte CSV: {0}" -f $ReportCsv)
  Write-Host ("Modo: {0}" -f $Mode)
  Write-Host ''

  $summary = $report | Group-Object resultado | Sort-Object Name
  foreach ($group in $summary) {
    Write-Host ("{0,-12}: {1}" -f $group.Name, $group.Count)
  }

  Write-Host ''
  Write-Host 'Listo.' -ForegroundColor Cyan
