# SPDX-License-Identifier: GPL-3.0-or-later

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$ForkUrl,

    [Parameter()]
    [ValidateNotNullOrEmpty()]
    [string]$RepoPath = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,

    [Parameter()]
    [ValidateNotNullOrEmpty()]
    [string]$UpstreamUrl = 'https://github.com/BlackMixture/Mix-Studio.git',

    [Parameter()]
    [ValidateNotNullOrEmpty()]
    [string]$BaselineRef = 'bec3292',

    [Parameter()]
    [ValidateNotNullOrEmpty()]
    [string]$BranchName = 'zh-tw'
)

$ErrorActionPreference = 'Stop'

function Invoke-RepoGit {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$GitArguments,

        [Parameter()]
        [switch]$AllowFailure
    )

    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $gitOutput = & git -C $script:ResolvedRepo @GitArguments 2>&1
        $gitExitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    if (-not $AllowFailure -and $gitExitCode -ne 0) {
        throw "git $($GitArguments -join ' ') failed:`n$($gitOutput -join [Environment]::NewLine)"
    }

    return [PSCustomObject]@{
        ExitCode = $gitExitCode
        Output = @($gitOutput)
    }
}

$script:ResolvedRepo = (Resolve-Path -LiteralPath $RepoPath).Path
$insideWorkTree = Invoke-RepoGit -GitArguments @('rev-parse', '--is-inside-work-tree')
if (($insideWorkTree.Output -join '').Trim() -ne 'true') {
    throw "RepoPath is not a Git work tree: $script:ResolvedRepo"
}

$baselineCheck = Invoke-RepoGit -GitArguments @('rev-parse', '--verify', "$BaselineRef^{commit}") -AllowFailure
if ($baselineCheck.ExitCode -ne 0) {
    throw "Baseline ref does not exist: $BaselineRef"
}
$baselineCommit = ($baselineCheck.Output -join '').Trim()

$remoteNames = @((Invoke-RepoGit -GitArguments @('remote')).Output)
$originIsUpstream = $false
if ($remoteNames -contains 'origin') {
    $currentOrigin = ((Invoke-RepoGit -GitArguments @('remote', 'get-url', 'origin')).Output -join '').Trim()
    $originIsUpstream = $currentOrigin.TrimEnd('/') -eq $UpstreamUrl.TrimEnd('/')
}

if ($originIsUpstream -and -not ($remoteNames -contains 'upstream')) {
    Invoke-RepoGit -GitArguments @('remote', 'rename', 'origin', 'upstream') | Out-Null
}

$remoteNames = @((Invoke-RepoGit -GitArguments @('remote')).Output)
if ($remoteNames -contains 'upstream') {
    Invoke-RepoGit -GitArguments @('remote', 'set-url', 'upstream', $UpstreamUrl) | Out-Null
} else {
    Invoke-RepoGit -GitArguments @('remote', 'add', 'upstream', $UpstreamUrl) | Out-Null
}

$remoteNames = @((Invoke-RepoGit -GitArguments @('remote')).Output)
if ($remoteNames -contains 'origin') {
    Invoke-RepoGit -GitArguments @('remote', 'set-url', 'origin', $ForkUrl) | Out-Null
} else {
    Invoke-RepoGit -GitArguments @('remote', 'add', 'origin', $ForkUrl) | Out-Null
}

$tagCheck = Invoke-RepoGit -GitArguments @('rev-parse', '--verify', 'baseline-bec3292^{commit}') -AllowFailure
if ($tagCheck.ExitCode -eq 0) {
    $tagCommit = ($tagCheck.Output -join '').Trim()
    if ($tagCommit -ne $baselineCommit) {
        throw "baseline-bec3292 already points to $tagCommit instead of $baselineCommit"
    }
} else {
    Invoke-RepoGit -GitArguments @('tag', 'baseline-bec3292', $BaselineRef) | Out-Null
}

$branchCheck = Invoke-RepoGit -GitArguments @('show-ref', '--verify', '--quiet', "refs/heads/$BranchName") -AllowFailure
if ($branchCheck.ExitCode -eq 0) {
    Invoke-RepoGit -GitArguments @('switch', $BranchName) | Out-Null
} else {
    Invoke-RepoGit -GitArguments @('switch', '-c', $BranchName, 'baseline-bec3292') | Out-Null
}

Invoke-RepoGit -GitArguments @('config', 'core.hooksPath', '.githooks') | Out-Null

[PSCustomObject]@{
    Repository = $script:ResolvedRepo
    Branch = ((Invoke-RepoGit -GitArguments @('branch', '--show-current')).Output -join '').Trim()
    Baseline = $baselineCommit
    Origin = ((Invoke-RepoGit -GitArguments @('remote', 'get-url', 'origin')).Output -join '').Trim()
    Upstream = ((Invoke-RepoGit -GitArguments @('remote', 'get-url', 'upstream')).Output -join '').Trim()
    HooksPath = ((Invoke-RepoGit -GitArguments @('config', '--get', 'core.hooksPath')).Output -join '').Trim()
} | Format-List
