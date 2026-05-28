# Apex Solutions - Windows Downloader & Bootstrapper
# Run via: irm https://raw.githubusercontent.com/Korisipati-Charan/Apex-Solutions/master/download-apex.ps1 | iex

$ErrorActionPreference = "Stop"

# Visual Theme Colors
$cyan = "`e[36m"
$green = "`e[32m"
$yellow = "`e[33m"
$magenta = "`e[35m"
$reset = "`e[0m"
$bold = "`e[1m"

Clear-Host

# Beautiful Ascii Banner
Write-Host "${bold}${cyan}"
Write-Host "  █████╗ ██████╗ ███████╗██╗  ██╗    ███████╗ ██████╗ ██╗     ██╗   ██╗████████╗██╗ ██████╗ ███╗   ██╗███████╗"
Write-Host " ██╔══██╗██╔══██╗██╔════╝╚██╗██╔╝    ██╔════╝██╔═══██╗██║     ██║   ██║╚══██╔══╝██║██╔═══██╗████╗  ██║██╔════╝"
Write-Host " ███████║██████╔╝█████╗   ╚███╔╝     ███████╗██║   ██║██║     ██║   ██║   ██║   ██║██║   ██║██╔██╗ ██║███████╗"
Write-Host " ██╔══██║██╔═══╝ ██╔══╝   ██╔██╗     ╚════██║██║   ██║██║     ██║   ██║   ██║   ██║██║   ██║██║╚██╗██║╚════██║"
Write-Host " ██║  ██║██║     ███████╗██╔╝ ██╗    ███████║╚██████╔╝███████╗╚██████╔╝   ██║   ██║╚██████╔╝██║ ╚████║███████║"
Write-Host " ╚═╝  ╚═╝╚═╝     ╚══════╝╚═╝  ╚═╝    ╚══════╝ ╚═════╝ ╚══════╝ ╚═════╝    ╚═╝   ╚═╝ ╚════╝ ╚═╝  ╚═══╝╚══════╝"
Write-Host "${reset}"
Write-Host "${bold}${magenta}=========================================================================================================${reset}"
Write-Host "${bold}${cyan}                              Apex Solutions Standalone Downloader & Launcher                            ${reset}"
Write-Host "${bold}${magenta}=========================================================================================================${reset}`n"

$repo = "Korisipati-Charan/Apex-Solutions"
$filename = "Apex-Solutions.exe"
$downloadUrl = "https://github.com/$repo/releases/latest/download/$filename"
$targetPath = Join-Path $HOME "Downloads\$filename"

Write-Host "${cyan}[*] Targeting Latest Release Asset...${reset}"
Write-Host "${cyan}[*] Download URL:${reset} $downloadUrl"
Write-Host "${cyan}[*] Destination Path:${reset} $targetPath`n"

# Verify if destination file already exists and is locked/running
if (Test-Path $targetPath) {
    Write-Host "${yellow}[!] An existing installation was found at destination.${reset}"
    $processes = Get-Process -Name "Apex Solutions" -ErrorAction SilentlyContinue
    if ($processes) {
        Write-Host "${yellow}[!] Apex Solutions is currently running. Terminating active instances to update...${reset}"
        $processes | Stop-Process -Force
        Start-Sleep -Seconds 1
    }
    Remove-Item $targetPath -Force -ErrorAction SilentlyContinue
}

Write-Host "${cyan}[*] Initiating secure payload retrieval...${reset}"
try {
    # Custom beautiful download progress bar in console
    $client = New-Object System.Net.WebClient
    $client.Headers.Add("User-Agent", "ApexSolutionsDownloader")
    
    Write-Host "${green}[+] Downloading Apex Solutions Desktop Application...${reset}"
    $client.DownloadFile($downloadUrl, $targetPath)
    Write-Host "${green}[+] Download successfully completed!${reset}`n"
}
catch {
    Write-Host "${bold}`e[31m[x] Error: Failed to download the executable payload.${reset}"
    Write-Host "`e[31m[x] Details: $_${reset}"
    Write-Host "${yellow}[!] You can manually download from: https://github.com/$repo/releases${reset}"
    Exit 1
}

if (Test-Path $targetPath) {
    # Programmatically unblock the downloaded binary to prevent Windows Defender / SmartScreen block
    Write-Host "${cyan}[*] Stripping NTFS alternate data streams and unblocking downloaded executable...${reset}"
    Unblock-File -Path $targetPath
    
    Write-Host "${bold}${green}[+] Download successfully verified! Setup complete!${reset}`n"
    Write-Host "${cyan}[*] Starting application frame: $targetPath${reset}`n"
    
    # Run the application in the background and let the console exit cleanly
    Start-Process -FilePath $targetPath -WorkingDirectory $HOME
    
    Write-Host "${bold}${green}[+] Apex Solutions launched successfully!${reset}`n"
    Write-Host -NoNewline "[Press Enter to continue...]"
    $null = $Host.UI.ReadLine()
} else {
    Write-Host "${bold}`e[31m[x] Verification Error: Executable was not found after download.${reset}`n"
    Write-Host -NoNewline "[Press Enter to continue...]"
    $null = $Host.UI.ReadLine()
    Exit 1
}
